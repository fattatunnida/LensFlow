import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Switch, Text, View } from 'react-native';
import type { Firestore } from 'firebase/firestore';
import { Button } from '../../components/Button';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips } from '../../components/FilterChips';
import { colors } from '../../theme/tokens';
import { clearDraft, draftKey, readDraft, writeDraft, type Draft } from './drafts';
import { useMasterDocument } from './hooks';
import { canWrite, leadSourceLabels, LEAD_SOURCES, MasterDataError, masterErrorMessage, type ClientInput, type ClientPayload, type ClientRecord, type LeadSource, type MasterActor, type MasterKind, type MasterPayloads, type MasterRecords, type PackageInput, type PhotoPackage } from './models';
import { duplicateClients, newMasterId, saveMaster } from './repository';
import { validateClient, validatePackage } from './validation';
import { DataError, FormField, LoadingData, MasterScreen, masterStyles as s } from './ui';
import { handoffBookingClient } from '../bookings/drafts';

export function ClientEditorScreen({ editing = false }: { editing?: boolean }) { return <MasterEditorScreen kind="clients" editing={editing} />; }
export function PackageEditorScreen({ editing = false }: { editing?: boolean }) { return <MasterEditorScreen kind="packages" editing={editing} />; }

function MasterEditorScreen({ kind, editing }: { kind: MasterKind; editing: boolean }) {
  const params = useLocalSearchParams<{ id?: string | string[]; forBooking?:string }>();
  const id = editing ? typeof params.id === 'string' ? params.id : '' : undefined;
  const resource = useMasterDocument(kind, id);
  const client = kind === 'clients';
  const title = `${editing ? 'Edit' : 'Tambah'} ${client ? 'pelanggan' : 'paket foto'}`;
  const saved = (recordId: string) => {
    if (client && !editing && params.forBooking === '1' && resource.actor) {
      handoffBookingClient(resource.actor.uid, resource.actor.studioId, recordId);
      router.dismissTo('/bookings/new');
      return;
    }
    if (editing && router.canDismiss()) router.dismiss();
    else router.replace(client ? { pathname: '/clients/[id]', params: { id: recordId } } : { pathname: '/packages/[id]', params: { id: recordId } });
  };
  if (!resource.actor || !canWrite(resource.actor, kind)) return <MasterScreen title={title} fallback={client ? '/clients' : '/packages'}><EmptyState icon="lock" title="Akses terbatas" description={client ? 'Anda memerlukan izin kalender dan CRM untuk mengelola pelanggan.' : 'Hanya pemilik studio yang dapat mengelola paket foto.'} /></MasterScreen>;
  if ((editing && !id) || (resource.status === 'ready' && editing && !resource.record)) return <MasterScreen title={title} fallback={client ? '/clients' : '/packages'}><EmptyState icon="search" title="Data tidak ditemukan" description="Kembali ke daftar untuk memilih data yang tersedia." /></MasterScreen>;
  if (resource.status !== 'ready') return <MasterScreen title={title} fallback={client ? '/clients' : '/packages'}>{resource.status === 'error' ? <DataError message={resource.error} retry={resource.reload} /> : <LoadingData />}</MasterScreen>;
  const common = { actor: resource.actor, db: resource.db, onSaved: saved, onReload: resource.reload, title };
  return client ? <ClientForm {...common} record={resource.record as ClientRecord | null} /> : <PackageForm {...common} record={resource.record as PhotoPackage | null} />;
}

type EditorProps<T> = { actor: MasterActor; db: Firestore; record: T | null; title: string; onSaved(id: string): void; onReload(): void };

function useEditorDraft<K extends MasterKind, I>(kind: K, actor: MasterActor, db: Firestore, record: MasterRecords[K] | null, initial: I, onSaved: (id: string) => void) {
  const key = draftKey(actor.uid, actor.studioId, kind, record?.id);
  const [draft, setDraft] = useState<Draft<I>>(() => readDraft<I>(key) ?? { id: record?.id ?? newMasterId(db), version: record?.version ?? null, values: initial });
  const [restored] = useState(() => !!readDraft<I>(key));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  function change<F extends keyof I>(field: F, value: I[F]) {
    if (lock.current) return;
    const next = { ...draft, values: { ...draft.values, [field]: value }, mutation: undefined };
    writeDraft(key, next); setDraft(next); setError('');
    setErrors((old) => ({ ...old, [field]: '' }));
  }
  function begin() {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setConflict(false); return true;
  }
  function finish() { lock.current = false; if (alive.current) setBusy(false); }
  function fail(cause: unknown) {
    if (!alive.current) return;
    setError(masterErrorMessage(cause)); setConflict(cause instanceof MasterDataError && cause.reason === 'conflict');
  }
  async function commit(payload: MasterPayloads[K]) {
    // A read-only duplicate check may finish after navigation or sign-out.
    // Do not restart a cancelled save or repopulate drafts after logout.
    if (!alive.current) return;
    const fingerprint = JSON.stringify(payload);
    const mutation = draft.mutation?.fingerprint === fingerprint ? draft.mutation : { fingerprint, id: newMasterId(db) };
    const next = { ...draft, mutation }; writeDraft(key, next); setDraft(next);
    await saveMaster(db, actor, kind, draft.id, draft.version, payload, mutation.id);
    clearDraft(key, mutation.id);
    if (alive.current) onSaved(draft.id);
  }
  return { draft, key, restored, errors, setErrors, error, conflict, busy, change, begin, finish, fail, commit };
}

function ClientForm({ actor, db, record, onSaved, onReload, title }: EditorProps<ClientRecord>) {
  const initial: ClientInput = record ? { name: record.name, phone: record.phone, email: record.email, address: record.address, notes: record.notes, leadSource: record.leadSource } : { name: '', phone: '', email: '', address: '', notes: '', leadSource: '' };
  const form = useEditorDraft('clients', actor, db, record, initial, onSaved);
  const value = form.draft.values;
  const [duplicate, setDuplicate] = useState<{ value: ClientPayload; names: string[] } | null>(null);
  const [reload, setReload] = useState(false);
  async function submit() {
    const checked = validateClient(value); form.setErrors(checked.errors);
    if (Object.keys(checked.errors).length || !form.begin()) return;
    try {
      const names = await duplicateClients(db, actor, checked.value.phone, form.draft.id);
      if (names.length) { setDuplicate({ value: checked.value, names }); return; }
      await form.commit(checked.value);
    } catch (cause) { form.fail(cause); }
    finally { form.finish(); }
  }
  async function confirmDuplicate() {
    if (!duplicate || !form.begin()) return;
    const payload = duplicate.value; setDuplicate(null);
    try { await form.commit(payload); } catch (cause) { form.fail(cause); } finally { form.finish(); }
  }
  return <MasterScreen title={title} busy={form.busy}>
    {form.restored && <Text style={s.muted}>Draft yang belum disimpan dipulihkan dari memori perangkat ini.</Text>}
    <FormField label="Nama lengkap" value={value.name} onChangeText={(text) => form.change('name', text)} maxLength={100} autoCapitalize="words" editable={!form.busy} error={form.errors.name} placeholder="Nama pelanggan" />
    <FormField label="Nomor telepon" value={value.phone} onChangeText={(text) => form.change('phone', text)} maxLength={32} keyboardType="phone-pad" editable={!form.busy} error={form.errors.phone} placeholder="081234567890" hint="Nomor akan disimpan dengan kode negara, misalnya +62." />
    <FormField label="Email (opsional)" value={value.email} onChangeText={(text) => form.change('email', text)} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!form.busy} error={form.errors.email} placeholder="nama@email.com" />
    <FormField label="Alamat (opsional)" value={value.address} onChangeText={(text) => form.change('address', text)} maxLength={500} multiline editable={!form.busy} error={form.errors.address} placeholder="Alamat pelanggan" />
    <Text style={s.title}>Sumber pelanggan</Text>
    <View pointerEvents={form.busy ? 'none' : 'auto'}><FilterChips<LeadSource> options={LEAD_SOURCES.map((key) => ({ key, label: leadSourceLabels[key] }))} selectedKey={value.leadSource} onSelect={(source) => form.change('leadSource', source)} /></View>
    <FormField label="Catatan (opsional)" value={value.notes} onChangeText={(text) => form.change('notes', text)} maxLength={2000} multiline editable={!form.busy} error={form.errors.notes} placeholder="Preferensi sesi atau informasi penting" />
    {Object.values(form.errors).some(Boolean) && <Text accessibilityRole="alert" style={s.error}>Lengkapi atau perbaiki isian yang ditandai di atas.</Text>}
    {!!form.error && <Text accessibilityRole="alert" style={s.error}>{form.error}</Text>}
    {form.conflict && <Button label="Muat data terbaru" secondary disabled={form.busy} onPress={() => setReload(true)} />}
    <Button label="Simpan pelanggan" tone="brand" loading={form.busy} onPress={() => { void submit(); }} />
    {duplicate && <ConfirmationModal visible title="Nomor sudah terdaftar" message={`Nomor ini dipakai oleh ${duplicate.names.join(', ')}. Tetap simpan sebagai kontak lain dengan nomor yang sama?`} confirmLabel="Tetap simpan" cancelLabel="Periksa kembali" loading={form.busy}
      onConfirm={() => { void confirmDuplicate(); }} onCancel={() => { if (!form.busy) setDuplicate(null); }} />}
    <ConfirmationModal visible={reload} title="Muat data terbaru?" message="Isian yang belum disimpan akan diganti dengan data studio terbaru." confirmLabel="Muat terbaru" cancelLabel="Tetap edit"
      onCancel={() => setReload(false)} onConfirm={() => { setReload(false); clearDraft(form.key); if (record) onReload(); else onSaved(form.draft.id); }} />
  </MasterScreen>;
}

function PackageForm({ actor, db, record, onSaved, onReload, title }: EditorProps<PhotoPackage>) {
  const initial: PackageInput = record ? { name: record.name, price: String(record.price), durationMinutes: String(record.durationMinutes), editedPhotosCount: String(record.editedPhotosCount), defaultLocation: record.defaultLocation, description: record.description, isActive: record.isActive } : { name: '', price: '', durationMinutes: '60', editedPhotosCount: '10', defaultLocation: 'Studio', description: '', isActive: true };
  const form = useEditorDraft('packages', actor, db, record, initial, onSaved);
  const value = form.draft.values;
  const [reload, setReload] = useState(false);
  async function submit() {
    const checked = validatePackage(value); form.setErrors(checked.errors);
    if (Object.keys(checked.errors).length || !form.begin()) return;
    try { await form.commit(checked.value); } catch (cause) { form.fail(cause); } finally { form.finish(); }
  }
  return <MasterScreen title={title} fallback="/packages" busy={form.busy}>
    {form.restored && <Text style={s.muted}>Draft yang belum disimpan dipulihkan dari memori perangkat ini.</Text>}
    <FormField label="Nama paket" value={value.name} onChangeText={(text) => form.change('name', text)} maxLength={100} autoCapitalize="words" editable={!form.busy} error={form.errors.name} placeholder="Paket Portrait" />
    <FormField label="Harga (Rp)" value={value.price} onChangeText={(text) => form.change('price', text)} maxLength={16} keyboardType="number-pad" editable={!form.busy} error={form.errors.price} placeholder="500000" hint="Rupiah bulat, contoh 500000 atau 500.000." />
    <View style={s.row}>
      <View style={s.grow}><FormField label="Durasi (menit)" value={value.durationMinutes} onChangeText={(text) => form.change('durationMinutes', text)} maxLength={4} keyboardType="number-pad" editable={!form.busy} error={form.errors.durationMinutes} /></View>
      <View style={s.grow}><FormField label="Jumlah foto edit" value={value.editedPhotosCount} onChangeText={(text) => form.change('editedPhotosCount', text)} maxLength={4} keyboardType="number-pad" editable={!form.busy} error={form.errors.editedPhotosCount} /></View>
    </View>
    <FormField label="Lokasi pemotretan" value={value.defaultLocation} onChangeText={(text) => form.change('defaultLocation', text)} maxLength={200} editable={!form.busy} error={form.errors.defaultLocation} placeholder="Studio A" />
    <FormField label="Deskripsi (opsional)" value={value.description} onChangeText={(text) => form.change('description', text)} maxLength={1000} multiline editable={!form.busy} error={form.errors.description} placeholder="Layanan yang termasuk dalam paket" />
    <View style={s.card}><View style={s.spread}><View style={s.grow}><Text style={s.title}>Paket aktif</Text><Text style={s.muted}>Tersedia untuk pilihan booking baru.</Text></View>
      <Switch accessibilityLabel="Paket aktif" value={value.isActive} disabled={form.busy} trackColor={{ false: colors.border, true: colors.ink }} onValueChange={(active) => form.change('isActive', active)} />
    </View></View>
    <Text style={s.muted}>Perubahan katalog berlaku untuk booking baru. Snapshot harga pada riwayat booking tidak diubah.</Text>
    {Object.values(form.errors).some(Boolean) && <Text accessibilityRole="alert" style={s.error}>Lengkapi atau perbaiki isian yang ditandai di atas.</Text>}
    {!!form.error && <Text accessibilityRole="alert" style={s.error}>{form.error}</Text>}
    {form.conflict && <Button label="Muat data terbaru" secondary disabled={form.busy} onPress={() => setReload(true)} />}
    <Button label="Simpan paket" tone="brand" loading={form.busy} onPress={() => { void submit(); }} />
    <ConfirmationModal visible={reload} title="Muat data terbaru?" message="Isian yang belum disimpan akan diganti dengan data studio terbaru." confirmLabel="Muat terbaru" cancelLabel="Tetap edit"
      onCancel={() => setReload(false)} onConfirm={() => { setReload(false); clearDraft(form.key); if (record) onReload(); else onSaved(form.draft.id); }} />
  </MasterScreen>;
}

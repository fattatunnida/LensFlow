import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Switch, Text, View } from 'react-native';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EmptyState } from '../../components/EmptyState';
import { ClientHistory } from '../bookings/ClientHistory';
import { formatCurrency, formatDate, formatDisplayPhone } from '../../lib/formatters';
import { colors } from '../../theme/tokens';
import { useMasterDocument } from './hooks';
import { canWrite, leadSourceLabels, masterErrorMessage, type MasterKind, type PackagePayload } from './models';
import { newMasterId, saveMaster } from './repository';
import { contactUrls } from './validation';
import { DataError, LoadingData, MasterScreen, masterStyles as s } from './ui';

export function ClientDetailScreen() { return <MasterDetailScreen kind="clients" />; }
export function PackageDetailScreen() { return <MasterDetailScreen kind="packages" />; }

function MasterDetailScreen({ kind }: { kind: MasterKind }) {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const resource = useMasterDocument(kind, id);
  const client = kind === 'clients';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lock = useRef(false), alive = useRef(false);
  const toggleAttempt = useRef<{ fingerprint: string; mutationId: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const record = resource.record;
  const fallback = client ? '/clients' : '/packages';
  const title = client ? 'Detail pelanggan' : 'Detail paket';

  async function contact(type: 'phone' | 'whatsapp') {
    if (!record || !('phone' in record) || lock.current) return;
    const urls = contactUrls(record.phone);
    if (!urls) { setError('Nomor telepon belum valid. Perbarui kontak terlebih dahulu.'); return; }
    try { await Linking.openURL(urls[type]); }
    catch { if (alive.current) setError(type === 'phone' ? 'Aplikasi telepon belum tersedia di perangkat ini.' : 'WhatsApp belum dapat dibuka. Coba lagi atau salin nomor kontak.'); }
  }
  async function toggleActive() {
    if (!record || !('price' in record) || !resource.actor || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setConfirm(false);
    const value: PackagePayload = { name: record.name, nameKey: record.nameKey, price: record.price, durationMinutes: record.durationMinutes, editedPhotosCount: record.editedPhotosCount, defaultLocation: record.defaultLocation, description: record.description, isActive: !record.isActive };
    const fingerprint = JSON.stringify([record.id, record.version, value]);
    if (toggleAttempt.current?.fingerprint !== fingerprint) toggleAttempt.current = { fingerprint, mutationId: newMasterId(resource.db) };
    try {
      await saveMaster(resource.db, resource.actor, 'packages', record.id, record.version, value, toggleAttempt.current.mutationId);
      if (alive.current) { toggleAttempt.current = null; resource.reload(); }
    } catch (cause) { if (alive.current) setError(masterErrorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  if (!resource.allowed) return <MasterScreen title={title} fallback={fallback}><EmptyState icon="lock" title="Akses terbatas" description="Anda belum memiliki izin untuk melihat data ini." /></MasterScreen>;
  if (resource.status !== 'ready') return <MasterScreen title={title} fallback={fallback}>{resource.status === 'error' ? <DataError message={resource.error} retry={resource.reload} /> : <LoadingData />}</MasterScreen>;
  if (!id || !record) return <MasterScreen title={title} fallback={fallback}><EmptyState icon="search" title="Data tidak ditemukan" description="Kembali ke daftar untuk memilih data yang masih tersedia." /></MasterScreen>;

  return <MasterScreen title={title} fallback={fallback} busy={busy}>
    <View style={s.card}>
      <View style={s.row}><View style={s.avatar}><Text style={s.initial}>{Array.from(record.name)[0]?.toUpperCase()}</Text></View><View style={s.grow}><Text style={[s.title, { fontSize: 20, lineHeight: 27 }]}>{record.name}</Text>{'phone' in record && <Text style={s.muted}>{formatDisplayPhone(record.phone)}</Text>}</View></View>
      {'isActive' in record && <Badge label={record.isActive ? 'Aktif' : 'Nonaktif'} variant={record.isActive ? 'success' : 'neutral'} />}
    </View>

    {'phone' in record ? <>
      <View style={s.row}><View style={s.grow}><Button label="Telepon" secondary onPress={() => { void contact('phone'); }} /></View><View style={s.grow}><Button label="WhatsApp" tone="brand" onPress={() => { void contact('whatsapp'); }} /></View></View>
      <View style={s.card}>
        <DetailLine label="Email" value={record.email || 'Belum diisi'} />
        <DetailLine label="Alamat" value={record.address || 'Belum diisi'} />
        <DetailLine label="Sumber pelanggan" value={leadSourceLabels[record.leadSource]} />
        <DetailLine label="Pelanggan sejak" value={formatDate(record.createdAt, { showDayName: false, monthStyle: 'long' })} />
      </View>
      <View style={s.card}><Text style={s.title}>Catatan</Text><Text style={s.text}>{record.notes || 'Belum ada catatan.'}</Text></View>
      <ClientHistory clientId={record.id} />
      {(resource.actor?.role === 'owner' || resource.actor?.booking) && <Button label="+ Booking untuk pelanggan ini" tone="brand" onPress={() => router.push({ pathname: '/bookings/new', params: { clientId: record.id } })} />}
    </> : <>
      <View style={s.card}>
        <Text style={[s.title, { fontSize: 28, lineHeight: 36 }]}>{formatCurrency(record.price)}</Text>
        <DetailLine label="Durasi pemotretan" value={`${record.durationMinutes} menit`} />
        <DetailLine label="Foto edit" value={`${record.editedPhotosCount} foto`} />
        <DetailLine label="Lokasi" value={record.defaultLocation} />
        <DetailLine label="Deskripsi" value={record.description || 'Belum ada deskripsi.'} />
      </View>
      {canWrite(resource.actor, 'packages') && <View style={s.card}><View style={s.spread}><View style={s.grow}><Text style={s.title}>Paket aktif</Text><Text style={s.muted}>{record.isActive ? 'Tersedia untuk booking baru.' : 'Tidak tersedia untuk booking baru.'}</Text></View>
        <Switch accessibilityLabel="Paket aktif" value={record.isActive} disabled={busy} trackColor={{ false: colors.border, true: colors.ink }} onValueChange={() => setConfirm(true)} />
      </View></View>}
      <Text style={s.muted}>Perubahan katalog tidak mengubah snapshot pada booking yang sudah tercatat.</Text>
      <ConfirmationModal visible={confirm} title={record.isActive ? 'Nonaktifkan paket?' : 'Aktifkan paket?'} message={record.isActive ? 'Paket tidak akan tersedia untuk booking baru. Riwayat booking tetap dipertahankan.' : 'Paket akan tersedia kembali untuk pilihan booking baru.'}
        confirmLabel={record.isActive ? 'Nonaktifkan' : 'Aktifkan'} loading={busy} onCancel={() => setConfirm(false)} onConfirm={() => { void toggleActive(); }} />
    </>}
    {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
    {canWrite(resource.actor, kind) && <Button label={client ? 'Edit pelanggan' : 'Edit paket'} secondary disabled={busy}
      onPress={() => router.push(client ? { pathname: '/clients/[id]/edit', params: { id: record.id } } : { pathname: '/packages/[id]/edit', params: { id: record.id } })} />}
    <Text style={s.muted}>Diperbarui {formatDate(record.updatedAt, { showDayName: false, monthStyle: 'long' })}</Text>
    <Button label="Muat ulang data" secondary disabled={busy} onPress={() => { setError(''); resource.reload(); }} />
  </MasterScreen>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 4 }}><Text style={s.muted}>{label}</Text><Text style={s.text}>{value}</Text></View>;
}

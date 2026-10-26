import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EmptyState } from '../../components/EmptyState';
import { formatCurrency } from '../../lib/formatters';
import { getFirebaseClient } from '../../lib/firebase/client';
import { draftKey, readDraft, writeDraft, clearDraft, type Draft } from '../master-data/drafts';
import { useMasterActor } from '../master-data/hooks';
import type { MasterActor } from '../master-data/models';
import { newMasterId } from '../master-data/repository';
import { FormField, MasterScreen, masterStyles as s } from '../master-data/ui';
import { ChoicePicker } from './ChoicePicker';
import { peekBookingClient, completeBookingHandoff } from './drafts';
import { addMinutes, bookingError, canManageBookings, errorReason, initialSchedule, scheduleErrors, type ClientChoice, type PackageChoice, type ScheduleInput, type Settings } from './models';
import { bookingChoices, checkAvailability, sendBooking } from './repository';
import { ScheduleFields } from './ui';
type Values=ScheduleInput & {step:number;client:ClientChoice|null;pkg:PackageChoice|null;settings:Settings;notes:string};
export default function NewBookingScreen(){
  const actor=useMasterActor();
  const params=useLocalSearchParams<{clientId?:string;date?:string}>();
  if(!actor||!canManageBookings(actor))return <MasterScreen title="Booking baru" fallback="/bookings"><EmptyState icon="lock" title="Akses terbatas" description="Anda memerlukan izin operasional booking."/></MasterScreen>;
  return <NewForm key={`${actor.uid}:${actor.studioId}`} actor={actor} clientId={typeof params.clientId==='string'?params.clientId:undefined} date={typeof params.date==='string'?params.date:undefined}/>;
}
function NewForm({actor,clientId,date}:{actor:MasterActor;clientId?:string;date?:string}){
  const key=draftKey(actor.uid,actor.studioId,'booking'),[draft,setDraft]=useState<Draft<Values>>(()=>readDraft<Values>(key)??{id:newMasterId(getFirebaseClient().db),version:null,values:{...initialSchedule(),...(date&&/^20\d\d-\d\d-\d\d$/.test(date)?{date}:{}),step:0,client:null,pkg:null,settings:{dpPercent:30,openingTime:'08:00',closingTime:'21:00',timezone:'Asia/Jakarta'},notes:''}});
  const [restored]=useState(()=>!!readDraft(key)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState<Record<string,string>>({}),[conflict,setConflict]=useState(false),[notice,setNotice]=useState(''),[stale,setStale]=useState(false),[exists,setExists]=useState(false);
  const lock=useRef(false),alive=useRef(false),prefilled=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  function update(patch:Partial<Values>){if(lock.current||!alive.current)return;setDraft(old=>{const next={...old,values:{...old.values,...patch},mutation:undefined};writeDraft(key,next);return next;});setError('');setNotice('');setErrors({});}
  useFocusEffect(useCallback(()=>{
    let active=true;const incoming=peekBookingClient(actor.uid,actor.studioId)||(!prefilled.current?clientId:undefined);
    if(incoming)void bookingChoices(actor.studioId,'clients','',null,incoming).then(page=>{if(active&&page.items[0]){update({client:page.items[0],step:0});prefilled.current=true;completeBookingHandoff(actor.uid,actor.studioId,incoming);}},cause=>{if(active)setError(bookingError(cause));});
    return()=>{active=false;};
    // The handoff is scoped to this stable user/studio; field edits do not rerun it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[actor.uid,actor.studioId,clientId]));
  const v=draft.values;
  function validate(){const issues=scheduleErrors(v);if(!v.client)issues.client='Pilih pelanggan.';if(!v.pkg)issues.pkg='Pilih paket aktif.';if(v.notes.length>2000)issues.notes='Catatan maksimal 2000 karakter.';setErrors(issues);if(Object.keys(issues).length){setError('Lengkapi pilihan serta perbaiki isian yang ditandai.');return false;}return true;}
  async function submit(checkOnly=false){
    if(lock.current||!validate()||!v.client||!v.pkg)return;
    lock.current=true;setBusy(true);setError('');setNotice('');setStale(false);
    try{
      if(checkOnly){const result=await checkAvailability(actor.studioId,v);if(alive.current){if(result.available)setNotice('Slot tersedia saat diperiksa. Ketersediaan diperiksa lagi saat menyimpan.');else setConflict(true);}return;}
      const payload={action:'create' as const,expectedVersion:null,clientId:v.client.id,packageId:v.pkg.id,clientVersion:v.client.version,packageVersion:v.pkg.version,dpPercent:v.settings.dpPercent,date:v.date,startTime:v.startTime,endTime:v.endTime,location:v.location.trim(),notes:v.notes.trim()};
      const fingerprint=JSON.stringify(payload),mutation=draft.mutation?.fingerprint===fingerprint?draft.mutation:{id:newMasterId(getFirebaseClient().db),fingerprint};
      const next={...draft,mutation};writeDraft(key,next);setDraft(next);
      const result=await sendBooking(actor.studioId,draft.id,mutation.id,payload);clearDraft(key,mutation.id);
      if(alive.current)router.replace({pathname:'/bookings/[id]',params:{id:result.id,created:'1'}});
    }catch(cause){if(alive.current){setError(bookingError(cause));setConflict(errorReason(cause)==='schedule-conflict');setStale(errorReason(cause)==='selection-stale');setExists(errorReason(cause)==='version-conflict');}}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return <MasterScreen title="Booking baru" fallback="/bookings" busy={busy}>
    <Text style={s.muted}>Langkah {v.step+1} dari 3 · {['Pelanggan','Paket foto','Jadwal & rincian'][v.step]}</Text>
    {restored&&<Text style={s.muted}>Draft sementara dipulihkan. Belum ada booking sampai server mengonfirmasi penyimpanan.</Text>}
    {v.step===0?<>
      <Text style={s.title}>Pilih pelanggan</Text>{v.client&&<Text style={s.text}>Terpilih: {v.client.name}</Text>}
      <ChoicePicker studioId={actor.studioId} kind="clients" selected={v.client?.id} onSelect={item=>update({client:item as ClientChoice})}/>
      {(actor.role==='owner'||actor.crm)&&<Button label="+ Pelanggan baru" secondary onPress={()=>router.push({pathname:'/clients/new',params:{forBooking:'1'}})}/>}
    </>:v.step===1?<>
      <Text style={s.title}>Pilih paket aktif</Text>{v.pkg&&<Text style={s.text}>Terpilih: {v.pkg.name} · {formatCurrency(v.pkg.price)}</Text>}
      <ChoicePicker studioId={actor.studioId} kind="packages" selected={v.pkg?.id} onSelect={(item,settings)=>{const pkg=item as PackageChoice;update({pkg,settings,location:pkg.defaultLocation,endTime:addMinutes(v.startTime,pkg.durationMinutes)});}}/>
    </>:<>
      <View style={s.card}><Text style={s.title}>{v.client?.name}</Text><Text style={s.text}>{v.pkg?.name} · {v.pkg&&formatCurrency(v.pkg.price)}</Text><Text style={s.muted}>{v.pkg?.durationMinutes} menit paket · {v.pkg?.editedPhotosCount} foto edit</Text></View>
      <Text style={s.muted}>Jam studio {v.settings.openingTime}–{v.settings.closingTime} WIB. Satu sesi pada satu waktu, termasuk lokasi luar studio.</Text>
      <ScheduleFields value={v} errors={errors} busy={busy} onChange={(field,value)=>update({[field]:value})}/>
      <FormField label="Catatan booking (opsional)" value={v.notes} onChangeText={notes=>update({notes})} multiline maxLength={2000} editable={!busy}/>
      <View style={s.card}><Text style={s.title}>Total {v.pkg&&formatCurrency(v.pkg.price)}</Text><Text style={s.text}>Target DP {v.settings.dpPercent}%: {v.pkg&&formatCurrency(Math.floor((v.pkg.price*v.settings.dpPercent+50)/100))}</Text><Text style={s.muted}>Belum ada uang diterima. DP dan pelunasan dicatat terpisah setelah booking tersimpan.</Text></View>
      <Button label="Cek ketersediaan" secondary disabled={busy} onPress={()=>{void submit(true);}}/>
    </>}
    {!!notice&&<Text accessibilityRole="alert" style={s.text}>{notice}</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {stale&&<Button label="Pilih ulang pelanggan & paket" secondary onPress={()=>update({step:0})}/>}
    {exists&&<Button label="Lihat booking yang tersimpan" secondary onPress={()=>router.replace({pathname:'/bookings/[id]',params:{id:draft.id}})}/>}
    {v.step>0&&<Button label="Langkah sebelumnya" secondary disabled={busy} onPress={()=>update({step:v.step-1})}/>}
    {v.step<2?<Button label="Lanjut" tone="brand" disabled={v.step===0?!v.client:!v.pkg} onPress={()=>update({step:v.step+1})}/>:<Button label="Simpan booking" tone="brand" loading={busy} onPress={()=>{void submit();}}/>}
    <ConfirmationModal visible={conflict} title="Jadwal bentrok" message="Slot sudah digunakan sesi lain. Isian Anda tetap tersimpan; sesuaikan tanggal atau jam lalu coba kembali." confirmLabel="Pilih jadwal lain" cancelLabel="Tetap di form" onConfirm={()=>setConflict(false)} onCancel={()=>setConflict(false)}/>
  </MasterScreen>;
}

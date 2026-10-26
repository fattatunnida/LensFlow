import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Button } from '../../components/Button';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EmptyState } from '../../components/EmptyState';
import { getFirebaseClient } from '../../lib/firebase/client';
import { draftKey,readDraft,writeDraft,clearDraft,type Draft } from '../master-data/drafts';
import { newMasterId } from '../master-data/repository';
import { DataError,FormField,LoadingData,MasterScreen,masterStyles as s } from '../master-data/ui';
import { useBooking } from './hooks';
import { bookingError,errorReason,scheduleErrors,type Booking,type Command,type ScheduleInput } from './models';
import { sendBooking } from './repository';
import { ScheduleFields } from './ui';
export default function ChangeBookingScreen({reschedule=false}:{reschedule?:boolean}){
  const params=useLocalSearchParams<{id?:string}>(),id=typeof params.id==='string'?params.id:'',resource=useBooking(id);
  const title=reschedule?'Ubah jadwal':'Edit booking';
  if(!resource.full||!resource.actor)return <MasterScreen title={title} fallback="/bookings"><EmptyState icon="lock" title="Akses terbatas" description="Anda memerlukan izin operasional booking."/></MasterScreen>;
  if(resource.loading||resource.error)return <MasterScreen title={title} fallback="/bookings">{resource.error?<DataError message={resource.error} retry={resource.reload}/>:<LoadingData/>}</MasterScreen>;
  if(!resource.record||resource.record.sessionStatus!=='confirmed')return <MasterScreen title={title} fallback="/bookings"><EmptyState icon="lock" title="Booking tidak dapat diubah" description="Booking yang sudah batal atau selesai tidak dapat diubah."/></MasterScreen>;
  return <ChangeForm key={JSON.stringify([resource.actor,id,resource.record.version])} record={resource.record as Booking} uid={resource.actor.uid} studioId={resource.actor.studioId} reschedule={reschedule} reload={resource.reload}/>;
}
type Values=ScheduleInput&{notes:string;reason:string};
function ChangeForm({record,uid,studioId,reschedule,reload}:{record:Booking;uid:string;studioId:string;reschedule:boolean;reload():void}){
  const key=draftKey(uid,studioId,reschedule?'booking-reschedule':'booking-edit',record.id),[draft,setDraft]=useState<Draft<Values>>(()=>readDraft<Values>(key)??{id:record.id,version:record.version,values:{date:record.date,startTime:record.startTime,endTime:record.endTime,location:record.location,notes:record.notes,reason:''}}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState<Record<string,string>>({}),[conflict,setConflict]=useState(false),[stale,setStale]=useState(false),[reset,setReset]=useState(false);
  const lock=useRef(false),alive=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const v=draft.values;
  function update(field:keyof Values,value:string){if(lock.current)return;const next={...draft,values:{...v,[field]:value},mutation:undefined};writeDraft(key,next);setDraft(next);setErrors({});setError('');}
  async function submit(){
    if(lock.current)return;const issues:Record<string,string>=reschedule?scheduleErrors(v):{};
    if(!v.location.trim())issues.location='Isi lokasi sesi.';if(reschedule&&v.reason.trim().length<3)issues.reason='Isi alasan minimal 3 karakter.';setErrors(issues);if(Object.keys(issues).length){setError('Perbaiki isian yang ditandai di atas.');return;}
    lock.current=true;setBusy(true);setError('');setStale(false);
    const command:Command=reschedule?{action:'reschedule',expectedVersion:draft.version!,date:v.date,startTime:v.startTime,endTime:v.endTime,location:v.location.trim(),reason:v.reason.trim()}:{action:'edit',expectedVersion:draft.version!,location:v.location.trim(),notes:v.notes.trim()};
    const fingerprint=JSON.stringify(command),mutation=draft.mutation?.fingerprint===fingerprint?draft.mutation:{id:newMasterId(getFirebaseClient().db),fingerprint};const next={...draft,mutation};writeDraft(key,next);setDraft(next);
    try{await sendBooking(studioId,record.id,mutation.id,command);clearDraft(key,mutation.id);if(alive.current){if(router.canDismiss())router.dismiss();else router.replace({pathname:'/bookings/[id]',params:{id:record.id}});}}
    catch(cause){if(alive.current){setError(bookingError(cause));setConflict(errorReason(cause)==='schedule-conflict');setStale(errorReason(cause)==='version-conflict');}}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return <MasterScreen title={reschedule?'Ubah jadwal':'Edit booking'} fallback="/bookings" busy={busy}>
    <Text style={s.title}>{record.code} · {record.clientName}</Text><Text style={s.muted}>Tersimpan: {record.date} · {record.startTime}–{record.endTime} WIB. Harga paket tetap.</Text>
    {reschedule?<><ScheduleFields value={v} onChange={update} errors={errors} busy={busy}/><FormField label="Alasan perubahan jadwal" value={v.reason} onChangeText={text=>update('reason',text)} maxLength={500} multiline editable={!busy} error={errors.reason}/></>:<><FormField label="Lokasi sesi" value={v.location} onChangeText={text=>update('location',text)} maxLength={200} editable={!busy} error={errors.location}/><FormField label="Catatan booking" value={v.notes} onChangeText={text=>update('notes',text)} maxLength={2000} multiline editable={!busy}/></>}
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {stale&&<Button label="Muat data terbaru" secondary disabled={busy} onPress={()=>setReset(true)}/>}
    <Button label={reschedule?'Simpan jadwal baru':'Simpan perubahan'} tone="brand" loading={busy} onPress={()=>{void submit();}}/>
    <ConfirmationModal visible={conflict} title="Jadwal bentrok" message="Jadwal lama tetap tersimpan. Isian baru belum diterapkan; pilih waktu lain." confirmLabel="Pilih waktu lain" onCancel={()=>setConflict(false)} onConfirm={()=>setConflict(false)}/>
    <ConfirmationModal visible={reset} title="Muat data terbaru?" message="Isian yang belum disimpan akan diganti dengan data server terbaru." confirmLabel="Muat terbaru" onCancel={()=>setReset(false)} onConfirm={()=>{clearDraft(key);setReset(false);reload();}}/>
  </MasterScreen>;
}

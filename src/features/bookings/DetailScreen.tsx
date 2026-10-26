import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Text, View } from 'react-native';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EmptyState } from '../../components/EmptyState';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { getFirebaseClient } from '../../lib/firebase/client';
import { newMasterId } from '../master-data/repository';
import { contactUrls } from '../master-data/validation';
import { DataError, FormField, LoadingData, MasterScreen, masterStyles as s } from '../master-data/ui';
import { useBooking } from './hooks';
import { bookingError, errorReason, paymentLabels, sessionLabels, type BookingEvent, type Command } from './models';
import { bookingEvents, sendBooking } from './repository';
import { canReadFinance,canReceive } from '../finance/models';
export default function BookingDetailScreen(){
  const params=useLocalSearchParams<{id?:string;created?:string}>(),id=typeof params.id==='string'?params.id:'';
  const resource=useBooking(id),record=resource.record;
  const [events,setEvents]=useState<BookingEvent[]>([]),[eventError,setEventError]=useState(''),[eventAttempt,setEventAttempt]=useState(0),[reason,setReason]=useState(''),[cancelling,setCancelling]=useState(false),[confirm,setConfirm]=useState<'cancel'|'complete'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false);
  const alive=useRef(false),lock=useRef(false),attempt=useRef<{fingerprint:string;id:string}|null>(null);
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useFocusEffect(useCallback(()=>{setClock(Date.now());const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]));
  useFocusEffect(useCallback(()=>{
    let active=true;setEvents([]);setEventError('');
    if(resource.actor&&resource.full&&record)void bookingEvents(resource.actor.studioId,id).then(items=>{if(active)setEvents(items);},cause=>{if(active)setEventError(bookingError(cause));});
    return()=>{active=false;};
    // Manual retry intentionally invalidates the event request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[resource.actor,resource.full,record,id,eventAttempt]));
  async function act(action:'cancel'|'complete'){
    if(!resource.actor||!record||lock.current)return;
    if(action==='cancel'&&reason.trim().length<3){setError('Isi alasan pembatalan minimal 3 karakter.');setConfirm(null);return;}
    lock.current=true;setBusy(true);setError('');setStale(false);setConfirm(null);
    const command:Command=action==='cancel'?{action,reason:reason.trim(),expectedVersion:record.version}:{action,expectedVersion:record.version};
    const fingerprint=JSON.stringify([id,command]);if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,id:newMasterId(getFirebaseClient().db)};
    try{await sendBooking(resource.actor.studioId,id,attempt.current.id,command);if(alive.current){attempt.current=null;setCancelling(false);setReason('');resource.reload();}}
    catch(cause){if(alive.current){setError(bookingError(cause));setStale(errorReason(cause)==='version-conflict');}}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  async function whatsapp(){if(!record||!('clientPhone'in record))return;const urls=contactUrls(record.clientPhone);if(!urls)return;try{await Linking.openURL(urls.whatsapp);}catch{if(alive.current)setError('WhatsApp belum dapat dibuka pada perangkat ini.');}}
  const body=!resource.allowed?<EmptyState icon="lock" title="Akses terbatas" description="Anda memerlukan izin booking atau kalender dan CRM."/>:resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:!record?<EmptyState icon="search" title="Booking tidak tersedia" description="Kembali ke daftar untuk memilih booking."/>:null;
  if(body)return <MasterScreen title="Detail booking" fallback="/bookings">{body}</MasterScreen>;
  if(!record)return null;
  const active=record.sessionStatus==='confirmed';
  return <MasterScreen title="Detail booking" fallback="/bookings" busy={busy}>
    {params.created==='1'&&<Text accessibilityRole="alert" style={s.text}>Booking tersimpan dan jadwal studio sudah diperbarui.</Text>}
    <View style={s.card}><Text style={s.title}>{record.code}</Text><View style={[s.row,{flexWrap:'wrap'}]}><Badge label={sessionLabels[record.sessionStatus]} variant={record.sessionStatus==='cancelled'?'error':'success'}/>{record.sessionStatus!=='cancelled'?<Badge label={paymentLabels[record.paymentStatus]} variant={record.paymentStatus==='paid'?'success':'warning'}/>:'paidAmount'in record&&<Badge label={{none:'Belum refund',partial:'Refund parsial',full:'Refund penuh'}[record.refundStatus??'none']} variant="neutral"/>}</View></View>
    <View style={s.card}><Text style={s.title}>{record.clientName}</Text>{'clientPhone'in record&&<><Text selectable style={s.text}>{record.clientPhone}</Text><Text style={s.muted}>{record.clientEmail||'Email belum diisi'}</Text><Button label="Hubungi via WhatsApp" secondary onPress={()=>{void whatsapp();}}/></>}</View>
    <View style={s.card}><Text style={s.title}>{record.packageName}</Text><Text style={s.text}>{formatDate(record.startAt,{monthStyle:'long'})}</Text><Text style={s.text}>{record.startTime}–{record.endTime} WIB</Text><Text style={s.text}>{record.location}</Text>{'packageSnapshot'in record&&<><Text style={s.muted}>{record.packageSnapshot.durationMinutes} menit paket · {record.packageSnapshot.editedPhotosCount} foto edit</Text><Text style={s.text}>{record.notes||'Tanpa catatan tambahan.'}</Text></>}</View>
    {'total'in record?<>
      <View style={s.card}><Text style={s.title}>Ringkasan pembayaran</Text><Line label="Total kontrak" value={formatCurrency(record.total)}/><Line label={`Target DP (${record.dpPercent}%)`} value={formatCurrency(record.dpTarget)}/><Line label="Diterima" value={formatCurrency(record.paidAmount)}/><Line label="Dikembalikan" value={formatCurrency(record.refundedAmount??0)}/><Line label={record.sessionStatus==='cancelled'?'Ditagih setelah batal':'Sisa tagihan'} value={formatCurrency(record.sessionStatus==='cancelled'?0:Math.max(0,record.total-record.paidAmount+(record.refundedAmount??0)))}/><Text style={s.muted}>{record.sessionStatus==='cancelled'?'Pembatalan tidak membuat refund otomatis. Riwayat pembayaran tetap dipertahankan.':'Selesai sesi tidak berarti lunas. Catat pembayaran hanya setelah uang diterima.'}</Text></View>
      {canReceive(resource.actor)&&record.sessionStatus!=='cancelled'&&record.total-record.paidAmount+(record.refundedAmount??0)>0&&<Button label="Terima pembayaran" tone="brand" onPress={()=>router.push({pathname:'/finance/receive/[id]',params:{id}})}/>}
      {canReadFinance(resource.actor)&&<Button label="Riwayat pembayaran & refund" secondary onPress={()=>router.push({pathname:'/finance/bookings/[id]',params:{id}})}/>}
      {!!record.cancellationReason&&<Text style={s.text}>Alasan batal: {record.cancellationReason}</Text>}
    </>:<Text style={s.muted}>Akses kalender menampilkan informasi jadwal. Kontak, catatan, nominal, dan perubahan booking memerlukan izin operasional booking.</Text>}
    {resource.full&&active&&<>
      <Button label="Ubah jadwal" secondary disabled={busy} onPress={()=>router.push({pathname:'/bookings/[id]/reschedule',params:{id}})}/>
      <Button label="Edit rincian booking" secondary disabled={busy} onPress={()=>router.push({pathname:'/bookings/[id]/edit',params:{id}})}/>
      <Button label="Tandai sesi selesai" tone="brand" disabled={busy||record.startAt>clock} onPress={()=>setConfirm('complete')}/>
      {record.startAt>clock&&<Text style={s.muted}>Sesi dapat diselesaikan setelah jam mulai tercapai.</Text>}
      <Button label={cancelling?'Tutup pembatalan':'Batalkan booking'} secondary disabled={busy} onPress={()=>setCancelling(v=>!v)}/>
      {cancelling&&<View style={s.card}><FormField label="Alasan pembatalan" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!busy}/><Text style={s.muted}>Slot dilepas; data booking tetap tersimpan. Tidak ada refund otomatis.</Text><Button label="Lanjutkan pembatalan" tone="brand" disabled={busy} onPress={()=>{if(reason.trim().length<3)setError('Isi alasan pembatalan minimal 3 karakter.');else setConfirm('cancel');}}/></View>}
    </>}
    {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{stale&&<Text style={s.muted}>Muat data terbaru untuk memeriksa perubahan sebelum mencoba kembali.</Text>}
    <Button label="Muat ulang booking" secondary disabled={busy} onPress={()=>{setError('');setStale(false);resource.reload();}}/>
    {resource.full&&<View style={s.card}><Text style={s.title}>Riwayat perubahan</Text>{events.map(event=><View key={event.id} style={{gap:4}}><Text style={s.text}>{({create:'Booking dibuat',reschedule:'Jadwal diubah',cancel:'Booking dibatalkan',complete:'Sesi selesai',edit:'Rincian diperbarui',income_dp:'DP dicatat',income_settlement:'Pelunasan dicatat',refund:'Refund dicatat'} as Record<string,string>)[event.action]??event.action} · v{event.version}</Text><Text style={s.muted}>{formatDate(event.createdAt,{showDayName:false})} · {event.date} {event.startTime}–{event.endTime}</Text>{!!event.reason&&<Text style={s.text}>{event.reason}</Text>}</View>)}<Text style={s.muted}>Maksimal 20 perubahan terbaru.</Text>{!!eventError&&<DataError message={eventError} retry={()=>setEventAttempt(v=>v+1)}/>}</View>}
    {confirm&&<ConfirmationModal visible title={confirm==='cancel'?'Batalkan booking?':'Selesaikan sesi?'} message={confirm==='cancel'?'Jadwal akan dilepas. Riwayat dan pembayaran tetap disimpan; pembatalan tidak mencatat refund.':'Sesi ditandai selesai. Status pembayaran tetap terpisah dan perubahan jadwal akan ditutup.'} confirmLabel={confirm==='cancel'?'Ya, batalkan':'Ya, selesaikan'} onCancel={()=>setConfirm(null)} onConfirm={()=>{void act(confirm);}} loading={busy}/>}
  </MasterScreen>;
}
function Line({label,value}:{label:string;value:string}){return <View style={s.spread}><Text style={[s.text,s.grow]}>{label}</Text><Text style={s.title}>{value}</Text></View>;}

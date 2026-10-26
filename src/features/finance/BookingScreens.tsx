import { useCallback,useRef,useState } from 'react';
import { router,useFocusEffect,useLocalSearchParams } from 'expo-router';
import { FlatList,Pressable,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { HeaderBar } from '../../components/HeaderBar';
import { SearchInput } from '../../components/SearchInput';
import { useDebounced } from '../bookings/hooks';
import { paymentLabels,sessionLabels } from '../bookings/models';
import { useMasterActor } from '../master-data/hooks';
import { DataError,LoadingData,MasterScreen,goBack,masterStyles as s } from '../master-data/ui';
import { useFinanceBooking,useLedger } from './hooks';
import { canReadFinance,canReceive,canPayOut,financeError,type BookingCursor,type FinanceBooking } from './models';
import { financeBookings } from './repository';
import { BookingMoney,LedgerRow } from './ui';
export function BookingPickerScreen(){
  const actor=useMasterActor(),allowed=canReadFinance(actor),[search,setSearch]=useState(''),term=useDebounced(search),key=JSON.stringify([actor,term]),generation=useRef(0),lock=useRef(false);
  const [state,setState]=useState<{key:string;items:FinanceBooking[];next:BookingCursor|null;loading:boolean;error:string;moreBusy:boolean}>({key:'',items:[],next:null,loading:true,error:'',moreBusy:false});
  const reload=useCallback(()=>{const request=++generation.current;lock.current=false;if(!actor||!allowed)return;setState({key,items:[],next:null,loading:true,error:'',moreBusy:false});void financeBookings(actor.studioId,term).then(page=>{if(request===generation.current)setState({...page,key,loading:false,error:'',moreBusy:false});},cause=>{if(request===generation.current)setState({key,items:[],next:null,loading:false,error:financeError(cause),moreBusy:false});});},[actor,allowed,key,term]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;lock.current=false;};},[reload]));
  async function more(){if(!actor||!state.next||lock.current||state.key!==key)return;lock.current=true;const request=generation.current;setState(old=>({...old,moreBusy:true,error:''}));try{const page=await financeBookings(actor.studioId,term,state.next);if(request===generation.current)setState(old=>({...old,...page,items:[...old.items,...page.items.filter(i=>!old.items.some(p=>p.id===i.id))],moreBusy:false}));}catch(cause){if(request===generation.current)setState(old=>({...old,error:financeError(cause),moreBusy:false}));}finally{if(request===generation.current)lock.current=false;}}
  const current=state.key===key?state:{items:[],next:null,loading:true,error:'',moreBusy:false};
  return <SafeAreaView style={s.safe}><FlatList style={s.flex} contentContainerStyle={s.page} data={allowed?current.items:[]} keyExtractor={b=>b.id} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Keuangan booking ${item.code}`} style={s.card} onPress={()=>router.push({pathname:'/finance/bookings/[id]',params:{id:item.id}})}><Text style={s.title}>{item.code} · {item.clientName}</Text><Text style={s.text}>{item.packageName}</Text><Text style={s.muted}>{item.date} · {sessionLabels[item.sessionStatus]} · {paymentLabels[item.paymentStatus]}</Text></Pressable>} ItemSeparatorComponent={()=><View style={{height:12}}/>}
    ListHeaderComponent={<View style={{gap:14,paddingBottom:18}}><HeaderBar title="Pilih booking" subtitle="Pembayaran dan riwayat uang" onBack={()=>goBack('/finance')}/>{allowed&&<><SearchInput value={search} onChangeText={setSearch} maxLength={64} placeholder="Cari pelanggan, kode, atau paket..."/><Text style={s.muted}>Cari awalan nama/kata, kode BK, atau tanggal YYYY-MM-DD.</Text></>}</View>}
    ListEmptyComponent={!allowed?<EmptyState icon="lock" title="Akses terbatas" description="Izin keuangan diperlukan."/>:current.loading?<LoadingData/>:current.error?<DataError message={current.error} retry={reload}/>:<EmptyState icon="calendar" title="Booking tidak ditemukan" description="Pilih pencarian lain atau buat booking terlebih dahulu melalui menu Booking."/>}
    ListFooterComponent={<View style={{paddingTop:16,gap:12}}>{current.next&&<Button label="Muat booking berikutnya" secondary loading={current.moreBusy} onPress={()=>{void more();}}/>}{!!current.error&&!!current.items.length&&<DataError message={current.error} retry={()=>{void more();}}/>}<Button label="Muat ulang pilihan" secondary onPress={reload}/></View>}/></SafeAreaView>;
}
export function FinanceBookingScreen(){
  const params=useLocalSearchParams<{id?:string}>(),id=typeof params.id==='string'?params.id:'',resource=useFinanceBooking(id),b=resource.data;
  return <MasterScreen title="Keuangan booking" fallback="/finance">
    {!resource.allowed?<EmptyState icon="lock" title="Akses terbatas" description="Anda memerlukan izin keuangan."/>:resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:!b?<EmptyState icon="search" title="Booking tidak tersedia" description="Kembali ke daftar untuk memilih booking."/>:<>
      <View style={s.card}><Text style={s.title}>{b.code} · {b.clientName}</Text><Text style={s.text}>{b.packageName}</Text><Text style={s.muted}>{b.date} · {b.startTime}–{b.endTime} WIB</Text><View style={[s.row,{flexWrap:'wrap'}]}><Badge label={sessionLabels[b.sessionStatus]}/>{b.sessionStatus!=='cancelled'&&<Badge label={paymentLabels[b.paymentStatus]} variant={b.paymentStatus==='paid'?'success':'warning'}/>} {b.sessionStatus==='cancelled'&&<Badge label={{none:'Belum refund',partial:'Refund parsial',full:'Refund penuh'}[b.refundStatus]} variant="neutral"/>}</View></View>
      <BookingMoney booking={b}/>
      {b.sessionStatus!=='cancelled'&&b.collectible>0&&canReceive(resource.actor)&&<Button label="Terima pembayaran" tone="brand" onPress={()=>router.push({pathname:'/finance/receive/[id]',params:{id}})}/>}
      {b.sessionStatus==='cancelled'&&b.netPaid>0&&canPayOut(resource.actor)&&<Button label="Catat refund pelanggan" tone="brand" onPress={()=>router.push({pathname:'/finance/refund/[id]',params:{id}})}/>}
      <Text style={s.muted}>{b.sessionStatus==='cancelled'?'Pembatalan tidak mengembalikan uang otomatis. Catat refund hanya setelah uang benar-benar dikembalikan.':'Selesai sesi tidak berarti lunas. Pembayaran hanya mencatat uang yang telah diterima; aplikasi tidak menagih bank.'}</Text>
      <Button label="Muat ulang saldo" secondary onPress={resource.reload}/><BookingLedger bookingId={id}/>
    </>}
  </MasterScreen>;
}
export function BookingLedger({bookingId}:{bookingId:string}){const resource=useLedger({bookingId});return <View style={{gap:12}}><Text style={s.title}>Riwayat uang booking</Text>{resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:<>{!resource.items.length&&<Text style={s.muted}>Belum ada pembayaran atau refund.</Text>}{resource.items.map(entry=><LedgerRow key={entry.id} entry={entry}/>)} {resource.hasMore&&<Button label="Muat riwayat berikutnya" secondary loading={resource.moreBusy} onPress={resource.loadMore}/>} {!!resource.moreError&&<DataError message={resource.moreError} retry={resource.loadMore}/>}</>}</View>;}

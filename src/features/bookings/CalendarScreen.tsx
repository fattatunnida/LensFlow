import { useState } from 'react';
import { router,useLocalSearchParams } from 'expo-router';
import { FlatList,Pressable,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips } from '../../components/FilterChips';
import { HeaderBar } from '../../components/HeaderBar';
import { formatDate } from '../../lib/formatters';
import { colors } from '../../theme/tokens';
import { DataError,FormField,LoadingData,masterStyles as s } from '../master-data/ui';
import { useSessions } from './hooks';
import { canManageBookings,dateWib,dayStart,shiftDate } from './models';
import { BookingRow } from './ui';
export default function CalendarScreen(){
  const params=useLocalSearchParams<{date?:string}>(),requestedDate=typeof params.date==='string'?params.date:'';
  const ms=dayStart(requestedDate),initialDate=/^20\d\d-\d\d-\d\d$/.test(requestedDate)&&Number.isFinite(ms)&&dateWib(ms)===requestedDate?requestedDate:dateWib();
  return <CalendarView key={requestedDate} initialDate={initialDate}/>;
}
function CalendarView({initialDate}:{initialDate:string}){
  const [view,setView]=useState<'day'|'week'>('day'),[date,setDate]=useState(initialDate),[input,setInput]=useState(date),[error,setError]=useState('');
  const weekday=new Date(`${date}T00:00:00Z`).getUTCDay(),start=view==='day'?date:shiftDate(date,-((weekday+6)%7)),end=shiftDate(start,view==='day'?1:7),resource=useSessions({from:dayStart(start),to:dayStart(end)});
  const items=resource.items.filter(item=>item.sessionStatus!=='cancelled');
  function choose(value:string){setDate(value);setInput(value);setError('');}
  function apply(){const ms=dayStart(input);if(!/^20\d\d-\d\d-\d\d$/.test(input)||!Number.isFinite(ms)||dateWib(ms)!==input)setError('Masukkan tanggal sah YYYY-MM-DD.');else choose(input);}
  return <SafeAreaView style={s.safe} edges={['top']}><FlatList style={s.flex} contentContainerStyle={s.page} data={resource.allowed?items:[]} keyExtractor={item=>item.id} ItemSeparatorComponent={()=><View style={{height:12}}/>} renderItem={({item,index})=><View style={{gap:10}}>{view==='week'&&(index===0||items[index-1].date!==item.date)&&<Text style={s.title}>{formatDate(item.startAt,{monthStyle:'long'})}</Text>}<View style={{borderLeftWidth:3,borderLeftColor:colors.ink,paddingLeft:12}}><Text style={[s.title,{marginBottom:8}]}>{item.startTime}</Text><BookingRow item={item}/></View></View>}
    ListHeaderComponent={<View style={{gap:14,paddingBottom:18}}><HeaderBar title="Kalender" subtitle="Satu kalender studio · WIB"/>{resource.allowed&&<>
      <FilterChips options={[{key:'day',label:'Hari'},{key:'week',label:'Minggu'}]} selectedKey={view} onSelect={setView}/>
      <View style={s.spread}><View style={s.grow}><Button label="Sebelumnya" secondary onPress={()=>choose(shiftDate(date,view==='day'?-1:-7))}/></View><View style={s.grow}><Button label="Berikutnya" secondary onPress={()=>choose(shiftDate(date,view==='day'?1:7))}/></View></View>
      <Text style={s.title}>{formatDate(dayStart(start),{monthStyle:'long'})}{view==='week'?` – ${formatDate(dayStart(shiftDate(end,-1)),{showDayName:false,monthStyle:'long'})}`:''}</Text>
      <View style={[s.row,{alignItems:'flex-end'}]}><View style={s.grow}><FormField label="Tanggal kalender" value={input} onChangeText={setInput} maxLength={10} placeholder="YYYY-MM-DD"/></View><Button label="Lihat" secondary onPress={apply}/></View>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Button label="Hari ini" secondary onPress={()=>choose(dateWib())}/>
      {view==='week'&&<View style={[s.row,{flexWrap:'wrap',gap:6}]}>{Array.from({length:7},(_,i)=>shiftDate(start,i)).map(day=><Pressable key={day} accessibilityRole="button" accessibilityLabel={`Lihat hari ${day}`} onPress={()=>{choose(day);setView('day');}} style={[s.card,{padding:10}]}><Text style={s.text}>{day.slice(8)}</Text></Pressable>)}</View>}
      <Text style={s.muted}>Booking batal tidak mengisi kalender. Daftar diperbarui saat kembali ke layar atau memilih muat ulang.</Text>
    </>}</View>}
    ListEmptyComponent={!resource.allowed?<EmptyState icon="lock" title="Akses kalender terbatas" description="Hubungi owner untuk izin booking atau kalender dan CRM."/>:resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:<EmptyState icon="calendar" title="Belum ada sesi pada periode ini" description="Pilih tanggal lain atau buat booking baru."/>}
    ListFooterComponent={<View style={{paddingTop:16,gap:12}}>{resource.moreError?<DataError message={resource.moreError} retry={resource.loadMore}/>:resource.hasMore&&<Button label="Muat jadwal berikutnya" secondary loading={resource.moreBusy} onPress={resource.loadMore}/>}<Button label="Muat ulang kalender" secondary onPress={resource.reload}/></View>}/>
    {canManageBookings(resource.actor)&&<View style={s.footer}><Button label="+ Booking di tanggal ini" tone="brand" onPress={()=>router.push({pathname:'/bookings/new',params:{date}})}/></View>}
  </SafeAreaView>;
}

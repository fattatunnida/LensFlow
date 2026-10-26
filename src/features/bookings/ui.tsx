import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Badge } from '../../components/Badge';
import { FormField, masterStyles as s } from '../master-data/ui';
import { formatDate } from '../../lib/formatters';
import { paymentLabels, sessionLabels, type Session, type ScheduleInput } from './models';
export function BookingRow({item}:{item:Session}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Detail booking ${item.code}`} onPress={()=>router.push({pathname:'/bookings/[id]',params:{id:item.id}})} style={({pressed})=>[s.card,{opacity:pressed?0.7:1}]}>
    <View style={s.spread}><Text style={s.muted}>{item.code}</Text><Text style={s.muted}>{formatDate(item.startAt,{showDayName:false})}</Text></View>
    <Text style={s.title}>{item.clientName}</Text><Text style={s.text}>{item.packageName}</Text>
    <Text style={s.muted}>{item.startTime}–{item.endTime} WIB · {item.location}</Text>
    <View style={[s.row,{flexWrap:'wrap'}]}><Badge label={sessionLabels[item.sessionStatus]} variant={item.sessionStatus==='cancelled'?'error':item.sessionStatus==='done'?'success':'neutral'} />{item.sessionStatus!=='cancelled'&&<Badge label={paymentLabels[item.paymentStatus]} variant={item.paymentStatus==='paid'?'success':'warning'} />}</View>
  </Pressable>;
}
export function ScheduleFields({value,onChange,errors={},busy=false}:{value:ScheduleInput;onChange(field:keyof ScheduleInput,value:string):void;errors?:Record<string,string>;busy?:boolean}) {
  return <>
    <FormField label="Tanggal sesi" placeholder="YYYY-MM-DD" value={value.date} onChangeText={v=>onChange('date',v)} maxLength={10} autoCapitalize="none" editable={!busy} error={errors.date} hint="Contoh 2026-11-02. Jadwal menggunakan WIB." />
    <View style={s.row}><View style={s.grow}><FormField label="Jam mulai" placeholder="09:00" value={value.startTime} onChangeText={v=>onChange('startTime',v)} maxLength={5} editable={!busy} error={errors.startTime} /></View><View style={s.grow}><FormField label="Jam selesai" placeholder="10:00" value={value.endTime} onChangeText={v=>onChange('endTime',v)} maxLength={5} editable={!busy} error={errors.endTime} /></View></View>
    <Text style={s.muted}>Gunakan HH:mm, kelipatan 15 menit, dan tanggal yang sama.</Text>
    <FormField label="Lokasi sesi" value={value.location} onChangeText={v=>onChange('location',v)} maxLength={200} editable={!busy} error={errors.location} />
  </>;
}

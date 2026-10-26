import { router } from 'expo-router';
import { Pressable,Text,View } from 'react-native';
import { Badge } from '../../components/Badge';
import { formatCurrency } from '../../lib/formatters';
import { masterStyles as s } from '../master-data/ui';
import { categoryLabels,kindLabels,methodLabels,type FinanceBooking,type LedgerEntry } from './models';
export function MoneyLine({label,amount}:{label:string;amount:number}){return <View style={s.spread}><Text style={[s.text,s.grow]}>{label}</Text><Text style={s.title}>{formatCurrency(amount)}</Text></View>;}
export function LedgerRow({entry}:{entry:LedgerEntry}){
  const income=entry.kind==='income_dp'||entry.kind==='income_settlement';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Detail transaksi ${kindLabels[entry.kind]} ${entry.id}`} onPress={()=>router.push({pathname:'/finance/entries/[id]',params:{id:entry.id}})} style={({pressed})=>[s.card,{opacity:pressed?0.7:1}]}>
    <View style={s.spread}><Badge label={kindLabels[entry.kind]} variant={income?'success':entry.kind==='refund'?'warning':'neutral'}/><Text style={s.muted}>{entry.effectiveDate}</Text></View>
    <Text style={s.title}>{income?'+':'−'} {formatCurrency(entry.amount)}</Text><Text style={s.text}>{entry.bookingId?`${entry.clientName} · ${entry.bookingCode}`:entry.description}</Text>
    <Text style={s.muted}>{methodLabels[entry.method]}{entry.category?` · ${categoryLabels[entry.category]}`:''}</Text>
  </Pressable>;
}
export function BookingMoney({booking:b}:{booking:FinanceBooking}){return <View style={s.card}><Text style={s.title}>Ringkasan pembayaran</Text><MoneyLine label="Harga kontrak" amount={b.total}/><MoneyLine label={`Target DP (${b.dpPercent}%)`} amount={b.dpTarget}/><MoneyLine label="Diterima" amount={b.receivedAmount}/><MoneyLine label="Dikembalikan" amount={b.refundedAmount}/><MoneyLine label="Bersih terbayar" amount={b.netPaid}/><MoneyLine label={b.sessionStatus==='cancelled'?'Ditagih setelah batal':'Sisa tagihan'} amount={b.collectible}/></View>;}

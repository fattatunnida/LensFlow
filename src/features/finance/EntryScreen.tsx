import { router,useLocalSearchParams } from 'expo-router';
import { Text,View } from 'react-native';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { formatCurrency,formatDate } from '../../lib/formatters';
import { DataError,LoadingData,MasterScreen,masterStyles as s } from '../master-data/ui';
import { useFinanceEntry } from './hooks';
import { categoryLabels,kindLabels,methodLabels } from './models';
export default function EntryScreen(){
  const params=useLocalSearchParams<{id?:string;saved?:string}>(),id=typeof params.id==='string'?params.id:'',resource=useFinanceEntry(id),entry=resource.data;
  return <MasterScreen title="Detail transaksi" fallback="/finance">{!resource.allowed?<EmptyState icon="lock" title="Akses terbatas" description="Izin keuangan diperlukan."/>:resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:!entry?<EmptyState icon="search" title="Transaksi tidak tersedia" description="Kembali ke Keuangan untuk memilih transaksi."/>:<>
    {params.saved==='1'&&<Text accessibilityRole="alert" style={s.text}>Transaksi sudah tercatat di ledger studio.</Text>}
    <View style={s.card}><Badge label={kindLabels[entry.kind]} variant={entry.kind.startsWith('income')?'success':'neutral'}/><Text style={[s.title,{fontSize:28,lineHeight:36}]}>{formatCurrency(entry.amount)}</Text><Text style={s.text}>{entry.effectiveDate} · {methodLabels[entry.method]}</Text>{!!entry.category&&<Text style={s.text}>{categoryLabels[entry.category]}</Text>}</View>
    {!!entry.bookingId&&<View style={s.card}><Text style={s.title}>{entry.bookingCode} · {entry.clientName}</Text><Button label="Keuangan booking terkait" secondary onPress={()=>router.push({pathname:'/finance/bookings/[id]',params:{id:entry.bookingId}})}/></View>}
    <View style={s.card}><Text style={s.title}>Uraian</Text><Text style={s.text}>{entry.description||'Tanpa catatan tambahan.'}</Text><Text style={s.muted}>Dicatat {formatDate(entry.createdAt,{monthStyle:'long'})}</Text><Text style={s.muted}>Pencatat: {entry.createdByName||entry.createdBy}</Text><Text selectable style={s.muted}>Referensi: {entry.id}</Text></View>
    {!!entry.originalEntryId&&<Button label="Lihat pembayaran asal" secondary onPress={()=>router.push({pathname:'/finance/entries/[id]',params:{id:entry.originalEntryId}})}/>}
    <Text style={s.muted}>Catatan ini tidak dapat diedit atau dihapus. {entry.kind==='refund'?'Refund mengurangi penerimaan bersih dan tidak dihitung lagi sebagai pengeluaran operasional.':'Metode pembayaran adalah label pencatatan; tidak ada transfer otomatis dari aplikasi.'}</Text>
    <Button label="Muat ulang transaksi" secondary onPress={resource.reload}/><Button label="Buka daftar keuangan" tone="brand" onPress={()=>router.dismissTo('/finance')}/>
  </>}</MasterScreen>;
}

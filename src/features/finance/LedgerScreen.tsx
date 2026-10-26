import { useState } from 'react';
import { router } from 'expo-router';
import { FlatList,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips } from '../../components/FilterChips';
import { HeaderBar } from '../../components/HeaderBar';
import { dateWib } from '../bookings/models';
import { DataError,FormField,LoadingData,goBack,masterStyles as s } from '../master-data/ui';
import { useFinanceSummary,useLedger } from './hooks';
import { canPayOut,canReceive,monthRange,type Method } from './models';
import { LedgerRow,MoneyLine } from './ui';
export default function LedgerScreen(){
  const [month,setMonth]=useState(()=>dateWib().slice(0,7)),[input,setInput]=useState(month),[monthError,setMonthError]=useState(''),[group,setGroup]=useState<'income'|'expense'|'refund'>('income'),[method,setMethod]=useState<'all'|Method>('all');
  const resource=useLedger({month,group,method}),summary=useFinanceSummary(month,method),totals=summary.data;
  return <SafeAreaView style={s.safe}><FlatList style={s.flex} contentContainerStyle={s.page} data={resource.allowed?resource.items:[]} keyExtractor={e=>e.id} renderItem={({item})=><LedgerRow entry={item}/>} ItemSeparatorComponent={()=><View style={{height:12}}/>}
    ListHeaderComponent={<View style={{gap:14,paddingBottom:18}}><HeaderBar title="Keuangan" subtitle="Pencatatan kas studio" onBack={()=>goBack('/more')}/>{resource.allowed&&<>
      <View style={[s.row,{alignItems:'flex-end'}]}><View style={s.grow}><FormField label="Bulan transaksi" value={input} onChangeText={setInput} maxLength={7} placeholder="YYYY-MM"/></View><Button label="Terapkan" secondary onPress={()=>{if(!monthRange(input))setMonthError('Gunakan bulan sah YYYY-MM.');else{setMonth(input);setMonthError('');}}}/></View>{!!monthError&&<Text accessibilityRole="alert" style={s.error}>{monthError}</Text>}
      <FilterChips options={[{key:'all',label:'Semua metode'},{key:'transfer',label:'Transfer'},{key:'qris',label:'QRIS'}]} selectedKey={method} onSelect={setMethod}/>
      {summary.loading?<LoadingData/>:summary.error?<DataError message={summary.error} retry={summary.reload}/>:totals&&<View style={s.card}><Text style={s.title}>Kas periode {month}</Text><MoneyLine label="Pemasukan bruto" amount={totals.income}/><MoneyLine label="Refund pelanggan" amount={totals.refund}/><MoneyLine label="Penerimaan bersih" amount={totals.income-totals.refund}/><MoneyLine label="Pengeluaran operasional" amount={totals.expense}/><MoneyLine label="Kas bersih periode" amount={totals.income-totals.refund-totals.expense}/><Text style={s.muted}>{totals.count} transaksi · seluruh jenis, sesuai bulan dan metode terpilih. Nilai kontrak yang belum dibayar tidak termasuk kas.</Text></View>}
      <FilterChips options={[{key:'income',label:'Pemasukan'},{key:'expense',label:'Pengeluaran'},{key:'refund',label:'Refund'}]} selectedKey={group} onSelect={setGroup}/>
      <Text style={s.muted}>Transaksi yang sudah tercatat tidak dapat diedit atau dihapus. Refund ditampilkan terpisah dari pengeluaran.</Text>
    </>}</View>}
    ListEmptyComponent={!resource.allowed?<EmptyState icon="lock" title="Akses keuangan terbatas" description="Hubungi owner untuk izin pembayaran atau laporan."/>:resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:<EmptyState icon="credit-card" title="Belum ada transaksi yang sesuai" description="Ubah bulan/metode atau catat uang yang telah diterima maupun dikeluarkan."/>}
    ListFooterComponent={<View style={{paddingTop:16,gap:12}}><Text style={s.muted}>{resource.items.length}{resource.hasMore?'+':''} transaksi dimuat</Text>{resource.moreError?<DataError message={resource.moreError} retry={resource.loadMore}/>:resource.hasMore&&<Button label="Muat transaksi berikutnya" secondary loading={resource.moreBusy} onPress={resource.loadMore}/>}<Button label="Muat ulang keuangan" secondary onPress={()=>{resource.reload();summary.reload();}}/></View>}/>
    {resource.allowed&&(canReceive(resource.actor)||canPayOut(resource.actor))&&<View style={s.footer}>{canReceive(resource.actor)&&<Button label="Terima pembayaran" tone="brand" onPress={()=>router.push('/finance/bookings')}/>}{canPayOut(resource.actor)&&<Button label="Catat pengeluaran" secondary onPress={()=>router.push('/finance/expense')}/>}</View>}
  </SafeAreaView>;
}

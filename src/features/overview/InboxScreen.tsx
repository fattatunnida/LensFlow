import { useCallback,useRef,useState } from 'react';
import { router,useFocusEffect } from 'expo-router';
import { FlatList,Pressable,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { HeaderBar } from '../../components/HeaderBar';
import { formatDate } from '../../lib/formatters';
import { bookingError } from '../bookings/models';
import { DataError,LoadingData,goBack,masterStyles as s } from '../master-data/ui';
import { useInbox } from './hooks';
import { inboxDestination,type InboxItem } from './models';
import { openInboxItem } from './repository';
export default function InboxScreen(){
  const resource=useInbox(),actor=resource.actor,[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),lock=useRef(false),generation=useRef(0);
  useFocusEffect(useCallback(()=>{if(!actor)return;++generation.current;lock.current=false;setBusy(null);return()=>{++generation.current;lock.current=false;};},[actor]));
  async function open(item:InboxItem){if(lock.current||!resource.actor)return;const request=generation.current;lock.current=true;setBusy(item.id);setError('');try{const result=await openInboxItem(resource.actor.studioId,item.id);if(request===generation.current)router.push(inboxDestination(result.target));}catch(cause){if(request===generation.current)setError(bookingError(cause));}finally{if(request===generation.current){lock.current=false;setBusy(null);}}}
  return <SafeAreaView style={s.safe}><FlatList style={s.flex} contentContainerStyle={s.page} data={resource.items} keyExtractor={item=>item.id} ItemSeparatorComponent={()=><View style={{height:12}}/>} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Buka notifikasi ${item.title} ${item.id}`} disabled={!!busy} onPress={()=>{void open(item);}} style={[s.card,!item.readAt&&{borderColor:'#8DAA9D'}]}><View style={s.spread}><Text style={[s.title,s.grow]}>{item.title}</Text>{!item.readAt&&<Badge label="Baru" variant="success"/>}</View><Text style={s.text}>{item.message}</Text><Text style={s.muted}>{formatDate(item.createdAt,{showDayName:false})}{busy===item.id?' · Membuka…':''}</Text></Pressable>}
    ListHeaderComponent={<View style={{gap:14,paddingBottom:18}}><HeaderBar title="Notifikasi" subtitle="Inbox studio · 30 hari terakhir" onBack={()=>goBack('/home')}/><Button label="Pengaturan notifikasi" secondary onPress={()=>router.push('/notifications/settings')}/><Text style={s.muted}>Pengingat yang sudah lunas, batal, atau berubah jadwal disembunyikan. Isi mengikuti izin Anda saat dibuka.</Text>{!!error&&<DataError message={error} retry={()=>{setError('');resource.reload();}}/>}</View>}
    ListEmptyComponent={resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:<EmptyState icon="bell" title="Belum ada notifikasi yang sesuai" description="Jadwal harian, pengingat pelunasan dan pembayaran masuk tampil sesuai izin serta preferensi Anda."/>}
    ListFooterComponent={<View style={{paddingTop:16,gap:12}}>{resource.pending&&<Text style={s.muted}>Masih ada pemberitahuan yang sedang disiapkan. Muat ulang untuk melanjutkan.</Text>}{resource.moreError?<DataError message={resource.moreError} retry={resource.more}/>:resource.next&&<Button label="Muat notifikasi berikutnya" secondary loading={resource.moreBusy} onPress={resource.more}/>}<Button label="Muat ulang notifikasi" secondary onPress={resource.reload}/></View>}/></SafeAreaView>;
}

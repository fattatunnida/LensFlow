import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips } from '../../components/FilterChips';
import { HeaderBar } from '../../components/HeaderBar';
import { SearchInput } from '../../components/SearchInput';
import { DataError, LoadingData, masterStyles as s } from '../master-data/ui';
import { useDebounced, useSessions } from './hooks';
import { bookingFilters, canManageBookings, type BookingFilter } from './models';
import { BookingRow } from './ui';
export default function BookingListScreen(){
  const [search,setSearch]=useState(''),[filter,setFilter]=useState<BookingFilter>('all'),term=useDebounced(search);
  const resource=useSessions({search:term,filter});
  return <SafeAreaView style={s.safe} edges={['top']}>
    <FlatList style={s.flex} contentContainerStyle={s.page} data={resource.allowed?resource.items:[]} keyExtractor={item=>item.id} renderItem={({item})=><BookingRow item={item}/>}
      ItemSeparatorComponent={()=><View style={{height:12}}/>}
      ListHeaderComponent={<View style={{gap:14,paddingBottom:18}}><HeaderBar title="Booking" subtitle="Jadwal dan status sesi studio" right={resource.allowed&&!resource.loading?<Badge label={`${resource.items.length}${resource.hasMore?'+':''} booking`} withDot={false}/>:undefined}/>
        {resource.allowed&&<><SearchInput value={search} onChangeText={setSearch} maxLength={64} placeholder="Cari pelanggan, paket, atau kode..."/><Text style={s.muted}>Cari awalan nama/kata, kode BK, atau tanggal YYYY-MM-DD. Data terbaru di atas.</Text><FilterChips options={bookingFilters} selectedKey={filter} onSelect={setFilter}/></>}
      </View>}
      ListEmptyComponent={!resource.allowed?<EmptyState icon="lock" title="Akses booking terbatas" description="Hubungi owner untuk izin booking atau kalender dan CRM."/>:resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:<EmptyState icon="calendar" title={term||filter!=='all'?'Tidak ada hasil yang sesuai':'Belum ada booking'} description="Booking yang tersimpan akan muncul di sini dan kalender studio."/>}
      ListFooterComponent={<View style={{gap:12,paddingTop:16}}>{resource.moreError?<DataError message={resource.moreError} retry={resource.loadMore}/>:resource.hasMore&&<Button label="Muat booking berikutnya" secondary loading={resource.moreBusy} onPress={resource.loadMore}/>}<Button label="Muat ulang daftar" secondary onPress={resource.reload}/></View>}/>
    {canManageBookings(resource.actor)&&<View style={s.footer}><Button label="+ Booking Baru" tone="brand" onPress={()=>router.push('/bookings/new')}/></View>}
  </SafeAreaView>;
}

import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DataError,LoadingData,masterStyles as s } from '../master-data/ui';
import { useSessions } from './hooks';
import { BookingRow } from './ui';
export function ClientHistory({clientId}:{clientId:string}){
  const resource=useSessions({clientId});
  return <View style={{gap:12}}><Text style={s.title}>Riwayat booking</Text>{resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:<>{!resource.items.length&&<Text style={s.muted}>Belum ada booking untuk pelanggan ini.</Text>}{resource.items.map(item=><BookingRow key={item.id} item={item}/>)}{resource.hasMore&&<Button label="Muat riwayat berikutnya" secondary loading={resource.moreBusy} onPress={resource.loadMore}/>} {!!resource.moreError&&<DataError message={resource.moreError} retry={resource.loadMore}/>}</>}</View>;
}

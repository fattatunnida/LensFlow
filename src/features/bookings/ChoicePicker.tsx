import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { EmptyState } from '../../components/EmptyState';
import { formatCurrency } from '../../lib/formatters';
import { DataError, LoadingData, masterStyles as s } from '../master-data/ui';
import { useDebounced } from './hooks';
import { bookingError, type ClientChoice, type PackageChoice, type Settings } from './models';
import { bookingChoices } from './repository';
export function ChoicePicker({studioId,kind,selected,onSelect}:{studioId:string;kind:'clients'|'packages';selected?:string;onSelect(item:ClientChoice|PackageChoice,settings:Settings):void}){
  const [search,setSearch]=useState(''),term=useDebounced(search),[items,setItems]=useState<(ClientChoice|PackageChoice)[]>([]),[next,setNext]=useState<[string,string]|null>(null),[settings,setSettings]=useState<Settings|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const generation=useRef(0),lock=useRef(false);
  useFocusEffect(useCallback(()=>{
    const request=++generation.current;setBusy(true);setItems([]);setNext(null);setError('');lock.current=true;
    void bookingChoices(studioId,kind,term).then(page=>{if(request===generation.current){setItems(page.items);setNext(page.next);setSettings(page.settings);}},cause=>{if(request===generation.current)setError(bookingError(cause));}).finally(()=>{if(request===generation.current){setBusy(false);lock.current=false;}});
    return()=>{++generation.current;lock.current=false;};
    // The reload button deliberately invalidates the focused server request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[studioId,kind,term,attempt]));
  async function more(){
    if(lock.current||!next)return;lock.current=true;setBusy(true);setError('');const request=generation.current;
    try{const page=await bookingChoices(studioId,kind,term,next);if(request===generation.current){setItems(page.items);setNext(page.next);}}
    catch(cause){if(request===generation.current)setError(bookingError(cause));}finally{if(request===generation.current){lock.current=false;setBusy(false);}}
  }
  return <View style={{gap:12}}><SearchInput value={search} onChangeText={setSearch} maxLength={100} placeholder={kind==='clients'?'Cari nama/telepon pelanggan...':'Cari nama paket aktif...'}/>
    <Text style={s.muted}>Ketik awalan nama{kind==='clients'?' atau nomor telepon':''}. Maksimal 25 pilihan per halaman.</Text>
    {items.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Pilih ${kind==='clients'?'pelanggan':'paket'} ${item.name}`} accessibilityState={{selected:item.id===selected}} onPress={()=>{if(settings)onSelect(item,settings);}} style={[s.card,item.id===selected&&{borderColor:'#203C35',borderWidth:2}]}>
      <Text style={s.title}>{item.name}{item.id===selected?' ✓':''}</Text><Text style={s.muted}>{'phone' in item?item.phone:`${formatCurrency(item.price)} · ${item.durationMinutes} menit · ${item.editedPhotosCount} foto edit`}</Text>
    </Pressable>)}
    {busy&&<LoadingData/>}{!!error&&<DataError message={error} retry={()=>{if(items.length&&next)void more();else setAttempt(v=>v+1);}}/>}{!busy&&!error&&!items.length&&<EmptyState icon="search" title="Belum ada pilihan" description={kind==='clients'?'Tambahkan pelanggan atau ubah pencarian.':'Buat/aktifkan paket melalui menu Paket Foto, lalu muat ulang.'}/>}
    {next&&<Button label="Muat pilihan berikutnya" secondary loading={busy} onPress={()=>{void more();}}/>}
    <Button label="Muat ulang pilihan" secondary disabled={busy} onPress={()=>setAttempt(v=>v+1)}/>
  </View>;
}

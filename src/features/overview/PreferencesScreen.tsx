import { useEffect,useRef,useState } from 'react';
import { Switch,Text,View } from 'react-native';
import { Button } from '../../components/Button';
import { bookingError } from '../bookings/models';
import { DataError,LoadingData,MasterScreen,masterStyles as s } from '../master-data/ui';
import { useInboxPreferences } from './hooks';
import type { InboxPreferences } from './models';
import { saveInboxPreferences } from './repository';
import { DeviceAlertSettings } from '../feedback/DeviceAlertSettings';
export default function PreferencesScreen(){const resource=useInboxPreferences();return <MasterScreen title="Pengaturan notifikasi" fallback="/notifications"><DeviceAlertSettings/>{resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:resource.data&&resource.actor&&<PreferencesForm key={JSON.stringify([resource.actor,resource.data])} studioId={resource.actor.studioId} initial={resource.data} reload={resource.reload}/>}</MasterScreen>;}
function PreferencesForm({studioId,initial,reload}:{studioId:string;initial:InboxPreferences;reload():void}){
  const [value,setValue]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),lock=useRef(false),alive=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function save(){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');setError('');try{const {schedule,payments,reminders,version}=value;const next=await saveInboxPreferences(studioId,{schedule,payments,reminders},version);if(alive.current){setValue(next);setMessage('Preferensi notifikasi tersimpan.');}}catch(cause){if(alive.current)setError(bookingError(cause));}finally{lock.current=false;if(alive.current)setBusy(false);}}
  return <><Text style={s.muted}>Atur pemberitahuan yang ingin Anda lihat di inbox aplikasi. Jenis yang tersedia mengikuti hak akses studio.</Text>{([{key:'schedule',title:'Ringkasan jadwal',description:'Jadwal harian studio, mulai pukul 07.00 WIB.'},{key:'reminders',title:'Pengingat pelunasan',description:'Sesi H-3/H-1 yang belum lunas, mulai pukul 09.00 WIB.'},{key:'payments',title:'Pembayaran masuk',description:'Konfirmasi DP dan pelunasan yang sudah tercatat.'}]as const).map(item=><View key={item.key} style={s.card}><View style={s.spread}><View style={s.grow}><Text style={s.title}>{item.title}</Text><Text style={s.muted}>{item.description}</Text></View><Switch accessibilityLabel={item.title} value={value[item.key]} disabled={busy} onValueChange={checked=>{setValue(old=>({...old,[item.key]:checked}));setMessage('');}}/></View></View>)}{!!message&&<Text accessibilityRole="alert" style={s.text}>{message}</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button label="Simpan preferensi" tone="brand" loading={busy} onPress={()=>{void save();}}/><Button label="Muat ulang preferensi" secondary disabled={busy} onPress={reload}/></>;
}

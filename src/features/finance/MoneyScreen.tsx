import { useCallback,useEffect,useRef,useState } from 'react';
import { router,useFocusEffect,useLocalSearchParams } from 'expo-router';
import { Pressable,Text,View } from 'react-native';
import { Button } from '../../components/Button';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips } from '../../components/FilterChips';
import { formatCurrency } from '../../lib/formatters';
import { getFirebaseClient } from '../../lib/firebase/client';
import { dateWib,errorReason } from '../bookings/models';
import { draftKey,readDraft,writeDraft,clearDraft,type Draft } from '../master-data/drafts';
import type { MasterActor } from '../master-data/models';
import { newMasterId } from '../master-data/repository';
import { DataError,FormField,LoadingData,MasterScreen,masterStyles as s } from '../master-data/ui';
import { useFinanceBooking } from './hooks';
import { canPayOut,canReceive,categoryLabels,financeError,kindLabels,methodLabels,moneyErrors,parseMoney,type FinanceBooking,type FinanceCommand,type MoneyValues,type RefundSource,type SourceCursor } from './models';
import { readEntry,refundSources,sendFinance } from './repository';
import { BookingMoney } from './ui';
type Mode='receive'|'expense'|'refund';
const titleFor=(mode:Mode)=>mode==='receive'?'Terima pembayaran':mode==='expense'?'Catat pengeluaran':'Catat refund';
export default function MoneyScreen({mode='receive'}:{mode?:Mode}){
  const params=useLocalSearchParams<{id?:string}>(),id=typeof params.id==='string'?params.id:'',resource=useFinanceBooking(mode==='expense'?'':id),actor=resource.actor;
  const permitted=mode==='receive'?canReceive(actor):canPayOut(actor);
  if(!actor||!permitted)return <MasterScreen title={titleFor(mode)} fallback="/finance"><EmptyState icon="lock" title="Akses terbatas" description={mode==='receive'?'Anda memerlukan izin pembayaran.':'Hanya owner yang dapat mencatat pengeluaran dan refund.'}/></MasterScreen>;
  if(mode!=='expense'&&(resource.loading||resource.error||!resource.data))return <MasterScreen title={titleFor(mode)} fallback="/finance">{resource.loading?<LoadingData/>:resource.error?<DataError message={resource.error} retry={resource.reload}/>:<EmptyState icon="search" title="Booking tidak tersedia" description="Pilih booking melalui menu Keuangan."/>}</MasterScreen>;
  return <MoneyForm key={JSON.stringify([actor,mode,id,resource.data?.version])} actor={actor} mode={mode} booking={resource.data} reload={resource.reload}/>;
}
function MoneyForm({actor,mode,booking:b,reload}:{actor:MasterActor;mode:Mode;booking:FinanceBooking|null;reload():void}){
  const key=draftKey(actor.uid,actor.studioId,`finance-${mode}`,b?.id),[draft,setDraft]=useState<Draft<MoneyValues>>(()=>{
    const cached=readDraft<MoneyValues>(key);if(cached)return cached;const partial=!!b&&b.dpTarget>0&&b.dpTarget<b.remaining;
    return {id:newMasterId(getFirebaseClient().db),version:b?.version??null,values:{kind:mode==='receive'?partial?'income_dp':'income_settlement':mode,amount:mode==='receive'&&b?String(partial?b.dpTarget:b.remaining||''):'',method:'transfer',effectiveDate:dateWib(),description:'',category:'operasional',source:null}};
  });
  const [restored]=useState(()=>!!readDraft(key)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState<Record<string,string>>({}),[confirm,setConfirm]=useState(false),[reset,setReset]=useState(false),[stale,setStale]=useState(()=>mode!=='expense'&&draft.version!==b?.version);
  const lock=useRef(false),alive=useRef(false),focused=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);useFocusEffect(useCallback(()=>{focused.current=true;return()=>{focused.current=false;};},[]));
  const v=draft.values;
  function change(patch:Partial<MoneyValues>){if(lock.current)return;const next={...draft,values:{...v,...patch},mutation:undefined};writeDraft(key,next);setDraft(next);setErrors({});setError('');}
  function payload():FinanceCommand {
    const base={kind:v.kind,amount:parseMoney(v.amount)!,method:v.method,effectiveDate:v.effectiveDate,description:v.description.trim(),acknowledged:true as const};
    return mode==='expense'?{...base,category:v.category}:{...base,bookingId:b!.id,expectedVersion:draft.version!,...(mode==='refund'?{originalEntryId:v.source!.id}:{})};
  }
  function validate(){
    let replay=false;if(draft.mutation){try{replay=draft.mutation.fingerprint===JSON.stringify(payload());}catch{replay=false;}}
    const issues=moneyErrors(v,b,replay);setErrors(issues);if(Object.keys(issues).length){setError('Perbaiki pilihan dan isian yang ditandai sebelum melanjutkan.');return false;}setError('');return true;
  }
  function openEntry(id:string){if(focused.current)router.replace({pathname:'/finance/entries/[id]',params:{id,saved:'1'}});}
  async function submit(){
    if(lock.current||!alive.current||!validate())return;lock.current=true;setBusy(true);setConfirm(false);setError('');
    const data=payload(),fingerprint=JSON.stringify(data),mutation=draft.mutation?.fingerprint===fingerprint?draft.mutation:{id:newMasterId(getFirebaseClient().db),fingerprint};const next={...draft,mutation};writeDraft(key,next);setDraft(next);
    try{const result=await sendFinance(actor.studioId,draft.id,mutation.id,data);clearDraft(key,mutation.id);if(alive.current)openEntry(result.entryId);}
    catch(cause){if(alive.current){setError(financeError(cause));setStale(errorReason(cause)==='version-conflict');}}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  async function inspectResult(discard=false){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{const entry=await readEntry(actor.studioId,draft.id);if(!alive.current)return;if(entry){clearDraft(key,draft.mutation?.id);openEntry(entry.id);}else if(discard&&focused.current){clearDraft(key,draft.mutation?.id);reload();}else setError('Transaksi dengan identitas ini belum ditemukan. Ulangi isian yang sama untuk memastikan hasil.');}
    catch(cause){if(alive.current)setError(financeError(cause));}finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return <MasterScreen title={titleFor(mode)} fallback="/finance" busy={busy}>
    {restored&&<Text style={s.muted}>Isian sementara dipulihkan. Periksa hasil transaksi sebelum membuat pencatatan baru.</Text>}
    {b&&<><Text style={s.title}>{b.code} · {b.clientName}</Text><BookingMoney booking={b}/></>}
    {mode==='receive'&&<View pointerEvents={busy?'none':'auto'}><FilterChips options={[{key:'income_dp',label:'DP'},{key:'income_settlement',label:'Pelunasan'}]} selectedKey={v.kind as 'income_dp'|'income_settlement'} onSelect={kind=>change({kind,amount:kind==='income_settlement'?String(b?.remaining??''):b&&b.dpTarget>0&&b.dpTarget<b.remaining?String(b.dpTarget):''})}/></View>}
    {mode==='refund'&&b&&<><Text style={s.title}>Pilih pembayaran asal</Text>{v.source&&<Text style={s.text}>Terpilih: {v.source.effectiveDate} · sisa refund {formatCurrency(v.source.remaining)}</Text>}<RefundPicker studioId={actor.studioId} bookingId={b.id} selected={v.source?.id} disabled={busy} onSelect={source=>change({source,amount:String(source.remaining)})}/>{!!errors.source&&<Text style={s.error}>{errors.source}</Text>}</>}
    {mode==='expense'&&<><Text style={s.title}>Kategori pengeluaran</Text><View pointerEvents={busy?'none':'auto'}><FilterChips options={Object.entries(categoryLabels).map(([key,label])=>({key:key as keyof typeof categoryLabels,label}))} selectedKey={v.category} onSelect={category=>change({category})}/></View><Text style={s.muted}>Untuk mengembalikan uang pelanggan, gunakan Refund dari booking terkait.</Text></>}
    <FormField label="Nominal (Rp)" value={v.amount} onChangeText={amount=>change({amount})} maxLength={16} keyboardType="number-pad" editable={!busy} error={errors.amount} hint="Rupiah bulat, contoh 150000 atau 150.000."/>
    <Text style={s.title}>Metode</Text><View pointerEvents={busy?'none':'auto'}><FilterChips options={[{key:'transfer',label:'Transfer'},{key:'qris',label:'QRIS'}]} selectedKey={v.method} onSelect={method=>change({method})}/></View>
    <FormField label="Tanggal transaksi" value={v.effectiveDate} onChangeText={effectiveDate=>change({effectiveDate})} maxLength={10} editable={!busy} error={errors.effectiveDate} hint="YYYY-MM-DD · WIB. Staf mencatat hari ini; backdate owner mengikuti batas studio (default 30 hari)."/>
    <FormField label={mode==='receive'?'Catatan pembayaran (opsional)':mode==='refund'?'Alasan refund':'Uraian pengeluaran'} value={v.description} onChangeText={description=>change({description})} maxLength={500} multiline editable={!busy} error={errors.description}/>
    {!!errors.booking&&<Text accessibilityRole="alert" style={s.error}>{errors.booking}</Text>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Text style={s.muted}>Catat hanya setelah uang benar-benar {mode==='receive'?'diterima':'dikeluarkan'}. Aplikasi tidak menjalankan transfer bank atau QRIS. Transaksi tercatat tidak dapat diedit/dihapus.</Text>
    {stale&&<><Text style={s.error}>Versi saldo berbeda dari draft. Periksa hasil atau muat saldo terbaru.</Text><Button label="Muat saldo terbaru" secondary disabled={busy} onPress={()=>setReset(true)}/></>}
    {draft.mutation&&<Button label="Periksa hasil transaksi" secondary disabled={busy} onPress={()=>{void inspectResult();}}/>}
    <Button label={mode==='receive'?'Catat pembayaran':mode==='expense'?'Catat pengeluaran':'Catat refund'} tone="brand" loading={busy} onPress={()=>{if(validate())setConfirm(true);}}/>
    {confirm&&<ConfirmationModal visible title="Konfirmasi pencatatan" message={`${kindLabels[v.kind]} ${formatCurrency(parseMoney(v.amount)??0)} melalui ${methodLabels[v.method]}, tanggal ${v.effectiveDate}. Pastikan uang sudah benar-benar ${mode==='receive'?'diterima':'dikeluarkan'} dan belum dicatat sebelumnya.`} confirmLabel="Ya, uang sudah diverifikasi" cancelLabel="Periksa kembali" onCancel={()=>setConfirm(false)} onConfirm={()=>{void submit();}} loading={busy}/>}
    <ConfirmationModal visible={reset} title="Muat saldo terbaru?" message="Hasil transaksi diperiksa dahulu. Jika belum tercatat, isian draft akan diganti dengan saldo dan pilihan terbaru." confirmLabel="Periksa dan muat" onCancel={()=>setReset(false)} onConfirm={()=>{setReset(false);void inspectResult(true);}}/>
  </MasterScreen>;
}
function RefundPicker({studioId,bookingId,selected,disabled,onSelect}:{studioId:string;bookingId:string;selected?:string;disabled:boolean;onSelect(source:RefundSource):void}){
  const [state,setState]=useState<{items:RefundSource[];next:SourceCursor|null;loading:boolean;error:string}>({items:[],next:null,loading:true,error:''}),[reload,setReload]=useState(0),generation=useRef(0),lock=useRef(false);
  useFocusEffect(useCallback(()=>{const request=++generation.current;setState({items:[],next:null,loading:true,error:''});lock.current=true;void refundSources(studioId,bookingId).then(page=>{if(request===generation.current)setState({...page,loading:false,error:''});},cause=>{if(request===generation.current)setState({items:[],next:null,loading:false,error:financeError(cause)});}).finally(()=>{if(request===generation.current)lock.current=false;});return()=>{++generation.current;lock.current=false;};
    // Reload explicitly refreshes refundable amounts after a failed request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[studioId,bookingId,reload]));
  async function more(){if(lock.current||!state.next)return;const request=generation.current;lock.current=true;setState(old=>({...old,loading:true,error:''}));try{const page=await refundSources(studioId,bookingId,state.next);if(request===generation.current)setState({...page,loading:false,error:''});}catch(cause){if(request===generation.current)setState(old=>({...old,loading:false,error:financeError(cause)}));}finally{if(request===generation.current)lock.current=false;}}
  return <View style={{gap:12}}>{state.items.map(source=><Pressable key={source.id} accessibilityRole="button" accessibilityLabel={`Pilih pembayaran asal ${source.id}`} accessibilityState={{selected:selected===source.id,disabled:disabled||source.remaining<=0}} disabled={disabled||source.remaining<=0} onPress={()=>onSelect(source)} style={[s.card,selected===source.id&&{borderColor:'#203C35',borderWidth:2},source.remaining<=0&&{opacity:0.5}]}><Text style={s.title}>{source.effectiveDate} · {formatCurrency(source.amount)} {selected===source.id?'✓':''}</Text><Text style={s.text}>{methodLabels[source.method]} · sisa refund {formatCurrency(source.remaining)}</Text><Text style={s.muted}>Referensi asal: {source.id}</Text></Pressable>)}{state.loading&&<LoadingData/>}{!!state.error&&<DataError message={state.error} retry={()=>setReload(v=>v+1)}/>} {!state.loading&&!state.error&&!state.items.length&&<Text style={s.muted}>Belum ada pembayaran asal untuk direfund.</Text>}{state.next&&<Button label="Pembayaran asal berikutnya" secondary loading={state.loading} onPress={()=>{void more();}}/>}<Button label="Muat ulang pembayaran asal" secondary disabled={disabled||state.loading} onPress={()=>setReload(v=>v+1)}/></View>;
}

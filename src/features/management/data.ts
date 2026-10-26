import { useCallback,useRef,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { firestoreCall } from '../../lib/firestore-api';
import { useMasterActor } from '../master-data/hooks';
import type { Permissions } from '../../lib/auth/session';
export type StudioSettings={name:string;address:string;phone:string;openingTime:string;closingTime:string;defaultDpPercent:number;timezone:string;version:number};
export type Profile={displayName:string;email:string;phone:string;jobTitle:string;version:number};
export type Staff={uid:string;displayName:string;email:string;role:'owner'|'staff';status:'active'|'inactive'|'invited';pendingInvitation:boolean;permissions:Permissions;version:number};
export type StaffPage={items:Staff[];next:string|null};
export type ReportBucket={key:string;from:string;to:string;income:number;refund:number;expense:number;count:number};
export type Report={from:string;to:string;unit:'day'|'week'|'month';income:number;refund:number;netIncome:number;expense:number;cashNet:number;count:number;buckets:ReportBucket[];generatedAt:number;timezone:string};
export const callProject=<T,>(name:string,data:unknown)=>firestoreCall<unknown,T>(name,{timeout:40000})(data).then(r=>r.data);
export function projectError(error:unknown){const e=error as {code?:string;message?:string};return e.code&&(e.code.startsWith('app/')||['functions/invalid-argument','functions/aborted','functions/already-exists','functions/failed-precondition','functions/resource-exhausted','functions/permission-denied'].includes(e.code))?e.message??'Permintaan belum berhasil.':e.code==='permission-denied'?'Tindakan ditolak oleh aturan akses studio. Muat ulang data dan coba lagi.':'Belum dapat terhubung. Periksa koneksi, lalu coba lagi.';}
export function useProjectRead<T>(name:string,options:Record<string,unknown>={},permission:'owner'|'reports'|'self'='owner'){
  const actor=useMasterActor(),allowed=!!actor&&(permission==='self'||actor.role==='owner'||permission==='reports'&&actor.reports===true),serialized=JSON.stringify(options),key=JSON.stringify([actor,name,serialized]),generation=useRef(0);
  const [state,setState]=useState<{key:string;data:T|null;loading:boolean;error:string}>({key:'',data:null,loading:true,error:''});
  const reload=useCallback(()=>{const request=++generation.current;if(!actor||!allowed)return;setState({key,data:null,loading:true,error:''});void callProject<T>(name,{studioId:actor.studioId,...JSON.parse(serialized)}).then(data=>{if(request===generation.current)setState({key,data,loading:false,error:''});},error=>{if(request===generation.current)setState({key,data:null,loading:false,error:projectError(error)});});},[actor,allowed,key,name,serialized]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;};},[reload]));
  return {...(state.key===key?state:{data:null,loading:true,error:''}),actor,allowed,reload};
}
export function useProjectSave(){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),lock=useRef(false),generation=useRef(0);
  useFocusEffect(useCallback(()=>{const request=++generation.current;setBusy(false);lock.current=false;return()=>{if(request===generation.current)++generation.current;};},[]));
  async function run<T>(work:()=>Promise<T>,onSaved:(value:T)=>void){if(lock.current)return;const request=generation.current;lock.current=true;setBusy(true);setError('');setMessage('');try{const result=await work();if(request===generation.current){onSaved(result);setMessage('Perubahan tersimpan.');}}catch(cause){if(request===generation.current)setError(projectError(cause));}finally{if(request===generation.current){lock.current=false;setBusy(false);}}}
  return {busy,error,message,run};
}

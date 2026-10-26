import { useCallback,useRef,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMasterActor } from '../master-data/hooks';
import { bookingError } from '../bookings/models';
import type { Dashboard,InboxItem,InboxCursor,InboxPreferences } from './models';
import { readDashboard,readInbox,readInboxPreferences } from './repository';
function useOverview<T>(kind:'dashboard'|'preferences'){
  const actor=useMasterActor(),key=JSON.stringify([actor,kind]),generation=useRef(0),[state,setState]=useState<{key:string;data:T|null;loading:boolean;error:string}>({key:'',data:null,loading:true,error:''});
  const reload=useCallback(()=>{const request=++generation.current;if(!actor)return;setState({key,data:null,loading:true,error:''});const promise=kind==='dashboard'?readDashboard(actor.studioId):readInboxPreferences(actor.studioId);void promise.then(data=>{if(request===generation.current)setState({key,data:data as T,loading:false,error:''});},cause=>{if(request===generation.current)setState({key,data:null,loading:false,error:bookingError(cause)});});},[actor,key,kind]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;};},[reload]));
  return {...(state.key===key?state:{data:null,loading:true,error:''}),actor,reload};
}
export const useDashboard=()=>useOverview<Dashboard>('dashboard');
export const useInboxPreferences=()=>useOverview<InboxPreferences>('preferences');
export function useInbox(){
  const actor=useMasterActor(),key=JSON.stringify(actor),generation=useRef(0),lock=useRef(false),[state,setState]=useState<{key:string;items:InboxItem[];next:InboxCursor|null;pending:boolean;loading:boolean;moreBusy:boolean;error:string;moreError:string}>({key:'',items:[],next:null,pending:false,loading:true,moreBusy:false,error:'',moreError:''});
  const reload=useCallback(()=>{const request=++generation.current;lock.current=false;if(!actor)return;setState({key,items:[],next:null,pending:false,loading:true,moreBusy:false,error:'',moreError:''});void readInbox(actor.studioId).then(page=>{if(request===generation.current)setState({...page,key,loading:false,moreBusy:false,error:'',moreError:''});},cause=>{if(request===generation.current)setState({key,items:[],next:null,pending:false,loading:false,moreBusy:false,error:bookingError(cause),moreError:''});});},[actor,key]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;lock.current=false;};},[reload]));
  function more(){if(!actor||!state.next||state.key!==key||lock.current)return;lock.current=true;const request=generation.current;setState(old=>({...old,moreBusy:true,moreError:''}));void readInbox(actor.studioId,state.next).then(page=>{if(request===generation.current)setState(old=>({...old,...page,items:[...old.items,...page.items.filter(i=>!old.items.some(p=>p.id===i.id))],moreBusy:false}));},cause=>{if(request===generation.current)setState(old=>({...old,moreBusy:false,moreError:bookingError(cause)}));}).finally(()=>{if(request===generation.current)lock.current=false;});}
  return {...(state.key===key?state:{items:[],next:null,pending:false,loading:true,moreBusy:false,error:'',moreError:''}),actor,reload,more};
}

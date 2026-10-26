import { useCallback,useRef,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMasterActor } from '../master-data/hooks';
import { canReadFinance,financeError,type FinanceBooking,type FinanceSummary,type LedgerEntry,type Method } from './models';
import { financeBooking,financeSummary,ledgerPage,readEntry,type LedgerPage,type LedgerQuery } from './repository';
function useRead<T>(kind:'booking'|'summary'|'entry',options:{id?:string;month?:string;method?:'all'|Method},enabled=true){
  const actor=useMasterActor(),allowed=canReadFinance(actor),serialized=JSON.stringify(options),key=JSON.stringify([actor,kind,serialized]),generation=useRef(0);
  const [state,setState]=useState<{key:string;data:T|null;loading:boolean;error:string}>({key:'',data:null,loading:true,error:''});
  const reload=useCallback(()=>{
    const request=++generation.current;if(!actor||!allowed||!enabled)return;setState({key,data:null,loading:true,error:''});const args=JSON.parse(serialized) as typeof options;
    const promise=kind==='booking'?financeBooking(actor.studioId,args.id!):kind==='entry'?readEntry(actor.studioId,args.id!):financeSummary(actor.studioId,args.month!,args.method!);
    void promise.then(data=>{if(generation.current===request)setState({key,data:data as T|null,loading:false,error:''});},cause=>{if(generation.current===request)setState({key,data:null,loading:false,error:financeError(cause)});});
  },[actor,allowed,enabled,key,kind,serialized]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;};},[reload]));
  return {...(state.key===key?state:{data:null,loading:enabled,error:''}),actor,allowed,reload};
}
export const useFinanceBooking=(id:string)=>useRead<FinanceBooking>('booking',{id},!!id);
export const useFinanceEntry=(id:string)=>useRead<LedgerEntry>('entry',{id},!!id);
export const useFinanceSummary=(month:string,method:'all'|Method)=>useRead<FinanceSummary>('summary',{month,method});
export function useLedger(options:LedgerQuery){
  const actor=useMasterActor(),allowed=canReadFinance(actor),serialized=JSON.stringify(options),key=JSON.stringify([actor,serialized]);
  const generation=useRef(0),lock=useRef(false),[state,setState]=useState<LedgerPage&{key:string;loading:boolean;error:string;moreBusy:boolean;moreError:string}>({key:'',items:[],cursor:null,hasMore:false,loading:true,error:'',moreBusy:false,moreError:''});
  const reload=useCallback(()=>{
    const request=++generation.current;lock.current=false;if(!actor||!allowed)return;setState({key,items:[],cursor:null,hasMore:false,loading:true,error:'',moreBusy:false,moreError:''});
    void ledgerPage(actor.studioId,JSON.parse(serialized)).then(page=>{if(request===generation.current)setState({...page,key,loading:false,error:'',moreBusy:false,moreError:''});},cause=>{if(request===generation.current)setState({key,items:[],cursor:null,hasMore:false,loading:false,error:financeError(cause),moreBusy:false,moreError:''});});
  },[actor,allowed,key,serialized]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;lock.current=false;};},[reload]));
  function loadMore(){
    if(!actor||!allowed||lock.current||state.key!==key||!state.cursor||!state.hasMore)return;lock.current=true;const request=generation.current;setState(old=>({...old,moreBusy:true,moreError:''}));
    void ledgerPage(actor.studioId,options,state.cursor).then(page=>{if(request===generation.current)setState(old=>({...old,...page,items:[...old.items,...page.items.filter(i=>!old.items.some(p=>p.id===i.id))],moreBusy:false}));},cause=>{if(request===generation.current)setState(old=>({...old,moreBusy:false,moreError:financeError(cause)}));}).finally(()=>{if(request===generation.current)lock.current=false;});
  }
  return {...(state.key===key?state:{items:[],loading:true,error:'',moreBusy:false,moreError:'',hasMore:false,cursor:null}),actor,allowed,reload,loadMore};
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMasterActor } from '../master-data/hooks';
import { bookingError, canManageBookings, canReadSchedule, type Booking, type Session } from './models';
import { readBooking, sessionPage, type SessionPage, type SessionQuery } from './repository';
export function useSessions(options:SessionQuery) {
  const actor=useMasterActor(), allowed=canReadSchedule(actor);
  const serialized=JSON.stringify(options), key=JSON.stringify([actor,serialized]);
  const [state,setState]=useState<SessionPage & {key:string;loading:boolean;moreBusy:boolean;error:string;moreError:string}>({items:[],cursor:null,hasMore:false,key:'',loading:true,moreBusy:false,error:'',moreError:''});
  const generation=useRef(0), lock=useRef(false);
  const reload=useCallback(()=>{
    const request=++generation.current; lock.current=false;
    if(!actor||!allowed)return;
    setState({items:[],cursor:null,hasMore:false,key,loading:true,moreBusy:false,error:'',moreError:''});
    void sessionPage(actor.studioId,JSON.parse(serialized)).then(page=>{if(request===generation.current)setState({...page,key,loading:false,moreBusy:false,error:'',moreError:''});},cause=>{if(request===generation.current)setState({items:[],cursor:null,hasMore:false,key,loading:false,moreBusy:false,error:bookingError(cause),moreError:''});});
  },[actor,allowed,key,serialized]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;lock.current=false;};},[reload]));
  const loadMore=()=>{
    if(!actor||!allowed||lock.current||state.key!==key||!state.hasMore||!state.cursor)return;
    const request=generation.current;lock.current=true;setState(old=>({...old,moreBusy:true,moreError:''}));
    void sessionPage(actor.studioId,options,state.cursor).then(page=>{if(request===generation.current)setState(old=>({...old,...page,items:[...old.items,...page.items.filter(item=>!old.items.some(prior=>prior.id===item.id))],moreBusy:false}));},cause=>{if(request===generation.current)setState(old=>({...old,moreBusy:false,moreError:bookingError(cause)}));}).finally(()=>{if(request===generation.current)lock.current=false;});
  };
  return {...(state.key===key?state:{items:[],cursor:null,hasMore:false,loading:true,moreBusy:false,error:'',moreError:''}),actor,allowed,reload,loadMore};
}
export function useBooking(id:string) {
  const actor=useMasterActor(), full=canManageBookings(actor),allowed=canReadSchedule(actor),key=JSON.stringify([actor,id,full]);
  const [state,setState]=useState<{key:string;loading:boolean;record:Booking|Session|null;error:string}>({key:'',loading:true,record:null,error:''});
  const generation=useRef(0);
  const reload=useCallback(()=>{
    const request=++generation.current;if(!actor||!allowed)return;
    setState({key,loading:true,record:null,error:''});
    void readBooking(actor.studioId,id,full).then(record=>{if(request===generation.current)setState({key,loading:false,record,error:''});},cause=>{if(request===generation.current)setState({key,loading:false,record:null,error:bookingError(cause)});});
  },[actor,allowed,key,id,full]);
  useFocusEffect(useCallback(()=>{reload();return()=>{++generation.current;};},[reload]));
  return {...(state.key===key?state:{loading:true,record:null,error:''}),actor,allowed,full,reload};
}
export function useDebounced(value:string) {const [result,setResult]=useState(value);useEffect(()=>{const timer=setTimeout(()=>setResult(value),250);return()=>clearTimeout(timer);},[value]);return result;}

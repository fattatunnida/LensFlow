import { collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query, startAfter, Timestamp, where, type QueryConstraint, type QueryDocumentSnapshot, type DocumentSnapshot } from 'firebase/firestore';
import { firestoreCall } from '../../lib/firestore-api';
import { getFirebaseClient } from '../../lib/firebase/client';
import { serverRead } from '../master-data/repository';
import type { Booking, BookingEvent, BookingFilter, ChoicePage, ClientChoice, Command, CommandResult, PackageChoice, ScheduleInput, Session } from './models';
import { context } from '../spark/core';

function validId(id:string):string { if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid ID'); return id; }
function decode<T>(snapshot:DocumentSnapshot):T {
  const data = snapshot.data();
  if (!data || !(data.startAt instanceof Timestamp) || !(data.endAt instanceof Timestamp) || !Number.isInteger(data.version) || !['confirmed','done','cancelled'].includes(data.sessionStatus)) throw new Error('Invalid booking schema');
  return { ...data, id:snapshot.id, startAt:data.startAt.toMillis(), endAt:data.endAt.toMillis(), updatedAt:data.updatedAt?.toMillis(), createdAt:data.createdAt?.toMillis() } as T;
}
export function bookingChoices<K extends 'clients'|'packages'>(studioId:string,kind:K,search='',next:[string,string]|null=null,id?:string) {
  return firestoreCall<unknown,ChoicePage<K extends 'clients'?ClientChoice:PackageChoice>>('bookingChoices',{timeout:20000})({studioId,kind,search,next,...(id?{id}:{})}).then((result)=>result.data);
}
export function sendBooking(studioId:string,bookingId:string,mutationId:string,command:Command) {
  return firestoreCall<unknown,CommandResult>('bookingCommand',{timeout:40000})({studioId,bookingId,mutationId,...command}).then((result)=>result.data);
}
export function checkAvailability(studioId:string,input:ScheduleInput,exceptId?:string) {
  const {date,startTime,endTime}=input;
  return firestoreCall<unknown,{available:boolean}>('bookingAvailability',{timeout:20000})({studioId,date,startTime,endTime,...(exceptId?{exceptId}:{})}).then((result)=>result.data);
}
export type SessionQuery = {search?:string;filter?:BookingFilter;from?:number;to?:number;clientId?:string};
export type SessionPage = {items:Session[];cursor:QueryDocumentSnapshot|null;hasMore:boolean};
export async function sessionPage(studioId:string, options:SessionQuery, cursor?:QueryDocumentSnapshot|null):Promise<SessionPage> {
  const constraints:QueryConstraint[]=[];
  if(options.filter && options.filter!=='all') constraints.push(where('stateKey','==',options.filter));
  if(options.search?.trim()) constraints.push(where('searchTokens','array-contains',options.search.trim().replace(/\s+/g,' ').toLowerCase()));
  if(options.from!==undefined) constraints.push(where('startAt','>=',Timestamp.fromMillis(options.from)));
  if(options.to!==undefined) constraints.push(where('startAt','<',Timestamp.fromMillis(options.to)));
  if(options.clientId) constraints.push(where('clientId','==',validId(options.clientId)));
  constraints.push(orderBy('startAt',options.from===undefined?'desc':'asc'));
  if(cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(26));
  const page=await serverRead(getDocsFromServer(query(collection(getFirebaseClient().db,'studios',validId(studioId),'sessions'),...constraints)));
  const visible=page.docs.slice(0,25);
  return {items:visible.map((snapshot)=>decode<Session>(snapshot)),cursor:visible.at(-1)??null,hasMore:page.size>25};
}
export async function readBooking(studioId:string,id:string,full:boolean):Promise<Booking|Session|null> {
  const snapshot=await serverRead(getDocFromServer(doc(getFirebaseClient().db,'studios',validId(studioId),full?'bookings':'sessions',validId(id))));
  return snapshot.exists()?decode<Booking|Session>(snapshot):null;
}
export async function bookingEvents(studioId:string,id:string):Promise<BookingEvent[]> {
  const c=await context(studioId,'booking'),page=await serverRead(getDocsFromServer(query(collection(c.db,'studios',validId(studioId),'bookingMutations'),where('bookingId','==',validId(id)),orderBy('version','desc'),limit(20))));
  const events=page.docs.map(s=>({...s.data(),id:s.id,createdAt:s.get('createdAt').toMillis()} as BookingEvent));
  if(c.owner||c.member.permissions.payments||c.member.permissions.reports){const money=await serverRead(getDocsFromServer(query(collection(c.db,'studios',studioId,'transactions'),where('bookingId','==',id),orderBy('expectedVersion','desc'),limit(20))));for(const s of money.docs){const e=s.data();events.push({id:s.id,action:e.kind,actorId:e.createdBy,reason:e.description,version:e.expectedVersion+1,date:e.bookingDate,startTime:e.bookingStartTime,endTime:e.bookingEndTime,createdAt:e.createdAt.toMillis()});}}
  return events.sort((a,b)=>b.version-a.version).slice(0,20);
}

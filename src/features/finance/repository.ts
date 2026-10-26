import { collection,doc,getDocFromServer,getDocsFromServer,limit,orderBy,query,startAfter,Timestamp,where,type QueryConstraint,type QueryDocumentSnapshot,type DocumentSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseClient } from '../../lib/firebase/client';
import { serverRead } from '../master-data/repository';
import { monthRange,type BookingCursor,type FinanceBooking,type FinanceCommand,type FinancePage,type FinanceResult,type FinanceSummary,type LedgerEntry,type Method,type RefundSource,type SourceCursor } from './models';
function identifier(value:string){if(!/^[A-Za-z0-9_-]{1,128}$/.test(value))throw new Error('Invalid ID');return value;}
export function financeBookings(studioId:string,search='',next:BookingCursor|null=null,id?:string){return httpsCallable<unknown,FinancePage<FinanceBooking,BookingCursor>>(getFirebaseClient().functions,'financeBookings',{timeout:20000})({studioId,search,next,...(id?{id}:{})}).then(r=>r.data);}
export async function financeBooking(studioId:string,id:string):Promise<FinanceBooking|null>{return (await financeBookings(studioId,'',null,identifier(id))).items[0]??null;}
export function refundSources(studioId:string,bookingId:string,next:SourceCursor|null=null){return httpsCallable<unknown,FinancePage<RefundSource,SourceCursor>>(getFirebaseClient().functions,'financeSources',{timeout:20000})({studioId,bookingId,next}).then(r=>r.data);}
export function sendFinance(studioId:string,entryId:string,mutationId:string,command:FinanceCommand){return httpsCallable<unknown,FinanceResult>(getFirebaseClient().functions,'financeCommand',{timeout:40000})({studioId,entryId,mutationId,...command}).then(r=>r.data);}
function decode(snapshot:DocumentSnapshot):LedgerEntry {
  const d=snapshot.data();if(!d||!['income_dp','income_settlement','expense','refund'].includes(d.kind)||!Number.isSafeInteger(d.amount)||d.amount<=0||!['transfer','qris'].includes(d.method)||!(d.createdAt instanceof Timestamp)||!(d.effectiveAt instanceof Timestamp))throw new Error('Invalid ledger schema');
  return {...d,id:snapshot.id,createdAt:d.createdAt.toMillis(),effectiveAt:d.effectiveAt.toMillis()} as LedgerEntry;
}
export async function readEntry(studioId:string,id:string):Promise<LedgerEntry|null>{const snapshot=await serverRead(getDocFromServer(doc(getFirebaseClient().db,'studios',identifier(studioId),'transactions',identifier(id))));return snapshot.exists()?decode(snapshot):null;}
export type LedgerQuery={month?:string;group?:'all'|'income'|'expense'|'refund';method?:'all'|Method;bookingId?:string};
export type LedgerPage={items:LedgerEntry[];cursor:QueryDocumentSnapshot|null;hasMore:boolean};
export async function ledgerPage(studioId:string,options:LedgerQuery,cursor?:QueryDocumentSnapshot|null):Promise<LedgerPage>{
  const constraints:QueryConstraint[]=[];
  if(options.month){const range=monthRange(options.month);if(!range)throw new Error('Invalid month');constraints.push(where('effectiveAt','>=',Timestamp.fromMillis(range.from)),where('effectiveAt','<',Timestamp.fromMillis(range.to)));}
  if(options.group==='income')constraints.push(where('kind','in',['income_dp','income_settlement']));else if(options.group&&options.group!=='all')constraints.push(where('kind','==',options.group));
  if(options.method&&options.method!=='all')constraints.push(where('method','==',options.method));
  if(options.bookingId)constraints.push(where('bookingId','==',identifier(options.bookingId)));
  constraints.push(orderBy('effectiveAt','desc'));if(cursor)constraints.push(startAfter(cursor));constraints.push(limit(26));
  const page=await serverRead(getDocsFromServer(query(collection(getFirebaseClient().db,'studios',identifier(studioId),'transactions'),...constraints))),visible=page.docs.slice(0,25);
  return {items:visible.map(decode),cursor:visible.at(-1)??null,hasMore:page.size>25};
}
export async function financeSummary(studioId:string,month:string,method:'all'|Method):Promise<FinanceSummary>{
  if(!monthRange(month)||!['all','transfer','qris'].includes(method))throw new Error('Invalid filter');
  const snapshot=await serverRead(getDocFromServer(doc(getFirebaseClient().db,'studios',identifier(studioId),'financeMonths',`${month}_${method}`)));
  if(!snapshot.exists())return {income:0,refund:0,expense:0,count:0,version:0};const d=snapshot.data();
  if(!['income','refund','expense','count','version'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0))throw new Error('Invalid summary schema');return d as FinanceSummary;
}

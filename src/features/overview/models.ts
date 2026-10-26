import type { Href } from 'expo-router';
export type UpcomingSession={id:string;code:string;clientName:string;packageName:string;date:string;startTime:string;endTime:string;startAt:number;endAt:number;location:string;sessionStatus:'confirmed'|'done'|'cancelled';paymentStatus:'pending_dp'|'dp_paid'|'paid'};
export type Dashboard={today:string;generatedAt:number;canSeeSchedule:boolean;canSeeCash:boolean;sessionCount?:number;doneCount?:number;upcoming?:UpcomingSession[];cashIn?:number;refundOut?:number};
export type InboxTarget={kind:'calendar';date:string}|{kind:'financeBooking'|'financeEntry';id:string};
export type InboxItem={id:string;kind:'schedule'|'reminder'|'payment';title:string;message:string;target:InboxTarget;createdAt:number;readAt:number|null};
export type InboxCursor=[number,number,string];
export type InboxPage={items:InboxItem[];next:InboxCursor|null;pending:boolean};
export type InboxPreferences={schedule:boolean;payments:boolean;reminders:boolean;version:number};
export function inboxDestination(target:InboxTarget):Href {
  if(target?.kind==='calendar'&&/^20\d\d-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(target.date)&&new Date(`${target.date}T00:00:00Z`).toISOString().slice(0,10)===target.date)return {pathname:'/calendar',params:{date:target.date}};
  if(target&&(target.kind==='financeBooking'||target.kind==='financeEntry')&&/^[A-Za-z0-9_-]{1,128}$/.test(target.id))return target.kind==='financeBooking'?{pathname:'/finance/bookings/[id]',params:{id:target.id}}:{pathname:'/finance/entries/[id]',params:{id:target.id}};
  throw new Error('Tujuan notifikasi tidak valid.');
}

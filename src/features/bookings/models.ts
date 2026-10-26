import type { MasterActor } from '../master-data/models';
export type PaymentStatus = 'pending_dp' | 'dp_paid' | 'paid';
export type SessionStatus = 'confirmed' | 'done' | 'cancelled';
export type BookingFilter = 'all' | PaymentStatus | 'done' | 'cancelled';
export const bookingFilters: { key: BookingFilter; label: string }[] = [{key:'all',label:'Semua'},{key:'pending_dp',label:'Menunggu DP'},{key:'dp_paid',label:'DP Dibayar'},{key:'paid',label:'Lunas'},{key:'done',label:'Selesai'},{key:'cancelled',label:'Batal'}];
export const paymentLabels = { pending_dp:'Belum bayar', dp_paid:'DP Dibayar', paid:'Lunas' };
export const sessionLabels = { confirmed:'Dikonfirmasi', done:'Selesai', cancelled:'Dibatalkan' };
export type ClientChoice = { id:string; name:string; phone:string; email:string; version:number };
export type PackageChoice = { id:string; name:string; price:number; durationMinutes:number; editedPhotosCount:number; defaultLocation:string; description:string; version:number };
export type Settings = { dpPercent:number; openingTime:string; closingTime:string; timezone:string };
export type ChoicePage<T> = { items:T[]; next:[string,string] | null; settings:Settings };
export type Session = { id:string; bookingId:string; code:string; clientId:string; clientName:string; packageName:string; date:string; startTime:string; endTime:string; startAt:number; endAt:number; location:string; sessionStatus:SessionStatus; paymentStatus:PaymentStatus; version:number; updatedAt:number; stateKey:Exclude<BookingFilter,'all'> };
export type Booking = Session & { clientPhone:string; clientEmail:string; packageId:string; packageSnapshot:Omit<PackageChoice,'id'|'version'|'description'>; notes:string; total:number; paidAmount:number; refundedAmount?:number; refundStatus?:'none'|'partial'|'full'; dpTarget:number; dpPercent:number; cancellationReason?:string; createdAt:number; createdBy:string; updatedBy:string };
export type BookingEvent = { id:string; action:string; actorId:string; reason:string; version:number; date:string; startTime:string; endTime:string; createdAt:number };
export type ScheduleInput = { date:string; startTime:string; endTime:string; location:string };
export type CreateInput = ScheduleInput & { clientId:string; packageId:string; clientVersion:number; packageVersion:number; notes:string; dpPercent:number };
export type Command = { action:'create'; expectedVersion:null } & CreateInput | { action:'reschedule'; expectedVersion:number; reason:string } & ScheduleInput | { action:'edit'; expectedVersion:number; location:string; notes:string } | { action:'cancel'; expectedVersion:number; reason:string } | { action:'complete'; expectedVersion:number };
export type CommandResult = { id:string; version:number; code:string };
export const canManageBookings = (actor:MasterActor|null) => !!actor && (actor.role === 'owner' || actor.booking);
export const canReadSchedule = (actor:MasterActor|null) => !!actor && (actor.role === 'owner' || actor.booking || actor.crm);
export function bookingError(error:unknown):string {
  const e = error as { code?:string; message?:string };
  if (e.code?.startsWith('functions/') && !['functions/internal','functions/unavailable','functions/deadline-exceeded'].includes(e.code)) return e.message || 'Permintaan belum dapat diproses.';
  if (e.code === 'permission-denied') return 'Anda tidak memiliki izin membaca booking ini.';
  return 'Data belum dapat diproses. Periksa koneksi, lalu coba lagi dengan isian yang sama.';
}
export function errorReason(error:unknown):string { return (error as { details?:{reason?:string} })?.details?.reason ?? ''; }
export function dateWib(value:number|Date = Date.now()):string { return new Date(Number(value)+7*3600000).toISOString().slice(0,10); }
export function shiftDate(date:string, days:number):string { return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10); }
export function dayStart(date:string):number { return Date.parse(`${date}T00:00:00+07:00`); }
export function addMinutes(time:string, duration:number):string {
  const minutes = Number(time.slice(0,2))*60+Number(time.slice(3))+duration;
  return minutes<1440 ? `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}` : '';
}
export function initialSchedule():ScheduleInput {
  const now = new Date(Date.now()+7*3600000), minutes = Math.ceil((now.getUTCHours()*60+now.getUTCMinutes()+1)/15)*15;
  const start = Math.max(480,minutes);
  const time = start>1200 ? '08:00' : `${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`;
  return { date:start>1200 ? shiftDate(dateWib(),1) : dateWib(), startTime:time, endTime:addMinutes(time,60), location:'' };
}
export function scheduleErrors(value:ScheduleInput):Record<string,string> {
  const errors:Record<string,string> = {};
  const start = Date.parse(`${value.date}T${value.startTime}:00+07:00`), end = Date.parse(`${value.date}T${value.endTime}:00+07:00`);
  if (!/^20\d\d-\d\d-\d\d$/.test(value.date) || !Number.isFinite(start) || dateWib(start) !== value.date) errors.date='Gunakan tanggal yang sah: YYYY-MM-DD.';
  for (const field of ['startTime','endTime'] as const) if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(value[field])) errors[field]='Gunakan HH:mm dengan kelipatan 15 menit.';
  if (!errors.date && !errors.startTime && !errors.endTime && end-start<15*60000) errors.endTime='Selesai harus setelah mulai pada tanggal yang sama.';
  if (!value.location.trim() || value.location.trim().length>200) errors.location='Isi lokasi, maksimal 200 karakter.';
  return errors;
}

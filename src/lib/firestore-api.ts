import * as bookings from '../features/spark/bookings';
import * as finance from '../features/spark/finance';
import * as overview from '../features/spark/overview';
import * as management from '../features/spark/management';
import { fail,type Data } from '../features/spark/core';
import { feedback,type NoticeInput } from './feedback/store';
function savedNotice(name: string, d: Data): NoticeInput | null {
  const key = `${name}:${d.studioId}:${d.mutationId ?? `${d.uid ?? ''}:${d.expectedVersion ?? ''}`}`;
  if (name === 'bookingCommand') return { title: ({ create: 'Booking berhasil disimpan', edit: 'Booking diperbarui', reschedule: 'Jadwal berhasil diubah', cancel: 'Booking dibatalkan', complete: 'Sesi ditandai selesai' } as Record<string,string>)[d.action], key };
  if (name === 'financeCommand') return { title: d.kind === 'refund' ? 'Refund berhasil dicatat' : d.kind === 'expense' ? 'Pengeluaran berhasil dicatat' : 'Pembayaran berhasil dicatat', message: 'Transaksi sudah tersimpan di studio.', key };
  if (name === 'staffCommand') return { title: d.action === 'invite' ? 'Undangan staf dibuat' : d.action === 'inviteLink' ? 'Tautan undangan siap' : 'Akses staf diperbarui', ...(d.action === 'inviteLink' ? {} : { key }) };
  if (d.value && ['studioSettings','profileSettings','inboxPreferences'].includes(name)) return { title: name === 'studioSettings' ? 'Pengaturan studio disimpan' : name === 'profileSettings' ? 'Profil berhasil diperbarui' : 'Preferensi notifikasi disimpan', key };
  return null;
}
export function firestoreCall<Request,Response>(name:string,_options?:{timeout?:number}){
  return async (raw:Request):Promise<{data:Response}>=>{
    const d=raw as Data;
    const announce=feedback.capture();
    const handlers:Record<string,(d:Data)=>Promise<unknown>>={bookingChoices:bookings.choices,bookingCommand:bookings.command,bookingAvailability:bookings.availability,financeCommand:finance.command,financeBookings:finance.bookings,financeSources:finance.sources,dashboardRead:overview.dashboard,inboxList:overview.inbox,inboxRead:overview.mark,inboxPreferences:overview.preferences,reportsRead:overview.report,studioSettings:management.studio,profileSettings:management.profile,staffList:management.staff,staffCommand:management.staffCommand};
    const handler=handlers[name];if(!handler)fail('unimplemented','Bagian koneksi Firestore ini sedang disiapkan.');
    const data=await handler(d) as Response,notice=savedNotice(name,d);
    if(notice)announce(notice);
    return {data};
  };
}

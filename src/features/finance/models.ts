import type { MasterActor } from '../master-data/models';
import { bookingError,dateWib,dayStart } from '../bookings/models';
export type FinanceKind='income_dp'|'income_settlement'|'expense'|'refund';
export type Method='transfer'|'qris';
export const kindLabels:Record<FinanceKind,string>={income_dp:'DP',income_settlement:'Pelunasan',expense:'Pengeluaran',refund:'Refund pelanggan'};
export const methodLabels:Record<Method,string>={transfer:'Transfer',qris:'QRIS'};
export const categoryLabels={operasional:'Operasional',sewa_alat:'Sewa alat',cetak:'Cetak foto',utilitas:'Utilitas',konsumsi:'Konsumsi',lainnya:'Lainnya'};
export type Category=keyof typeof categoryLabels;
export type FinanceBooking={id:string;code:string;clientName:string;packageName:string;date:string;startTime:string;endTime:string;sessionStatus:'confirmed'|'done'|'cancelled';paymentStatus:'pending_dp'|'dp_paid'|'paid';version:number;total:number;receivedAmount:number;refundedAmount:number;netPaid:number;remaining:number;collectible:number;dpTarget:number;dpPercent:number;refundStatus:'none'|'partial'|'full'};
export type LedgerEntry={id:string;studioId:string;kind:FinanceKind;amount:number;method:Method;effectiveDate:string;effectiveAt:number;description:string;category:Category|'';bookingId:string;bookingCode:string;clientName:string;originalEntryId:string;createdAt:number;createdBy:string;createdByName?:string};
export type FinanceSummary={income:number;refund:number;expense:number;count:number;version:number};
export type RefundSource={id:string;amount:number;method:Method;effectiveDate:string;refundedAmount:number;remaining:number};
export type FinancePage<T,C>={items:T[];next:C|null};
export type BookingCursor=[number,string];
export type SourceCursor=[number,number,string];
export type FinanceCommand={kind:FinanceKind;amount:number;method:Method;effectiveDate:string;description:string;acknowledged:true;bookingId?:string;expectedVersion?:number;originalEntryId?:string;category?:Category};
export type FinanceResult={entryId:string;bookingId:string;bookingVersion:number|null};
export type MoneyValues={kind:FinanceKind;amount:string;method:Method;effectiveDate:string;description:string;category:Category;source:RefundSource|null};
export const canReadFinance=(actor:MasterActor|null)=>!!actor&&(actor.role==='owner'||actor.payments===true||actor.reports===true);
export const canReceive=(actor:MasterActor|null)=>!!actor&&(actor.role==='owner'||actor.payments===true);
export const canPayOut=(actor:MasterActor|null)=>actor?.role==='owner';
export function parseMoney(value:string):number|null {
  const raw=value.trim();if(!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(raw))return null;
  const number=Number(raw.replace(/\./g,''));return Number.isSafeInteger(number)&&number>0&&number<=1000000000?number:null;
}
export function monthRange(month:string):{from:number;to:number}|null {
  if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))return null;
  const year=Number(month.slice(0,4)),m=Number(month.slice(5));return {from:Date.UTC(year,m-1,1)-7*3600000,to:Date.UTC(year,m,1)-7*3600000};
}
export function moneyErrors(v:MoneyValues,b:FinanceBooking|null,replay=false):Record<string,string>{
  const errors:Record<string,string>={},amount=parseMoney(v.amount);
  if(amount===null)errors.amount='Masukkan rupiah bulat positif, contoh 150000 atau 150.000.';
  const date=dayStart(v.effectiveDate);if(!/^20\d\d-\d\d-\d\d$/.test(v.effectiveDate)||!Number.isFinite(date)||dateWib(date)!==v.effectiveDate)errors.effectiveDate='Gunakan tanggal sah YYYY-MM-DD.';
  if(v.description.trim().length>(500)||(['expense','refund'].includes(v.kind)&&v.description.trim().length<3))errors.description='Uraian/alasan wajib 3–500 karakter.';
  if(v.kind==='expense'&&!(v.category in categoryLabels))errors.category='Pilih kategori pengeluaran.';
  if(!['transfer','qris'].includes(v.method))errors.method='Pilih Transfer atau QRIS.';
  if(v.kind!=='expense'&&!b)errors.booking='Booking belum tersedia.';
  if(v.kind==='refund'&&!v.source)errors.source='Pilih pembayaran asal.';
  if(!replay&&b&&amount!==null){
    if(v.kind==='income_dp'||v.kind==='income_settlement'){
      if(b.sessionStatus==='cancelled'||b.collectible<=0)errors.booking='Booking batal atau sudah lunas tidak menerima pembayaran baru.';
      if(v.kind==='income_dp'&&amount>=b.remaining)errors.amount='DP harus lebih kecil dari sisa; gunakan Pelunasan untuk seluruh sisa.';
      if(v.kind==='income_settlement'&&amount!==b.remaining)errors.amount='Pelunasan harus sama dengan seluruh sisa terkini.';
    }
    if(v.kind==='refund'&&(b.sessionStatus!=='cancelled'||(v.source&&amount>v.source.remaining)))errors.amount='Refund memerlukan booking batal dan nominal tidak melebihi sisa pembayaran asal.';
  }
  return errors;
}
export function financeError(cause:unknown){if((cause as {code?:string})?.code==='permission-denied')return 'Anda belum memiliki izin membaca keuangan studio.';return bookingError(cause);}

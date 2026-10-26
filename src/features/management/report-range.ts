import { dateWib,shiftDate } from '../bookings/models';
export type ReportPreset='thisMonth'|'lastMonth'|'thisYear'|'custom';
export function reportRange(preset:Exclude<ReportPreset,'custom'>,today=dateWib()){
  const first=`${today.slice(0,7)}-01`;
  if(preset==='thisMonth')return {from:first,to:today};
  if(preset==='thisYear')return {from:`${today.slice(0,4)}-01-01`,to:today};
  const last=shiftDate(first,-1);return {from:`${last.slice(0,7)}-01`,to:last};
}

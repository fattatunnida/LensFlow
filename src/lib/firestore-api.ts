import * as bookings from '../features/spark/bookings';
import * as finance from '../features/spark/finance';
import * as overview from '../features/spark/overview';
import * as management from '../features/spark/management';
import { fail,type Data } from '../features/spark/core';
export function firestoreCall<Request,Response>(name:string,_options?:{timeout?:number}){
  return async (raw:Request):Promise<{data:Response}>=>{
    const d=raw as Data;
    const handlers:Record<string,(d:Data)=>Promise<unknown>>={bookingChoices:bookings.choices,bookingCommand:bookings.command,bookingAvailability:bookings.availability,financeCommand:finance.command,financeBookings:finance.bookings,financeSources:finance.sources,dashboardRead:overview.dashboard,inboxList:overview.inbox,inboxRead:overview.mark,inboxPreferences:overview.preferences,reportsRead:overview.report,studioSettings:management.studio,profileSettings:management.profile,staffList:management.staff,staffCommand:management.staffCommand};
    const handler=handlers[name];if(!handler)fail('unimplemented','Bagian koneksi Firestore ini sedang disiapkan.');return {data:await handler(d) as Response};
  };
}

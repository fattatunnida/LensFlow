import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMinutes,canManageBookings,canReadSchedule,dateWib,dayStart,shiftDate,scheduleErrors } from '../src/features/bookings/models';
import { handoffBookingClient,peekBookingClient,completeBookingHandoff,clearBookingHandoffs } from '../src/features/bookings/drafts';
test('booking time helpers use WIB independently of host timezone and handle date boundaries',()=>{
  assert.equal(dateWib(Date.parse('2026-10-25T18:00:00Z')),'2026-10-26');assert.equal(new Date(dayStart('2026-10-26')).toISOString(),'2026-10-25T17:00:00.000Z');assert.equal(shiftDate('2026-12-31',1),'2027-01-01');assert.equal(addMinutes('09:30',90),'11:00');assert.equal(addMinutes('23:30',60),'');
});
test('schedule validation rejects impossible dates, overnight intervals and non-quarter-hour input',()=>{
  const good={date:'2026-11-01',startTime:'09:00',endTime:'10:00',location:'Studio'};assert.deepEqual(scheduleErrors(good),{});
  for(const patch of [{date:'2026-02-30'},{date:'bad'},{startTime:'09:01'},{endTime:'08:00'},{endTime:'09:00'},{location:''}])assert.ok(Object.keys(scheduleErrors({...good,...patch})).length);
});
test('calendar/CRM access does not imply booking mutations',()=>{
  const actor={uid:'user',studioId:'studio',role:'staff' as const,crm:true,booking:false};assert.equal(canReadSchedule(actor),true);assert.equal(canManageBookings(actor),false);assert.equal(canManageBookings({...actor,booking:true}),true);assert.equal(canReadSchedule(null),false);
});
test('new-customer handoff is scoped, survives a cancelled read and clears on logout',()=>{
  clearBookingHandoffs();handoffBookingClient('a','studio','first');assert.equal(peekBookingClient('b','studio'),undefined);assert.equal(peekBookingClient('a','other'),undefined);assert.equal(peekBookingClient('a','studio'),'first');
  handoffBookingClient('a','studio','newer');completeBookingHandoff('a','studio','first');assert.equal(peekBookingClient('a','studio'),'newer');clearBookingHandoffs();assert.equal(peekBookingClient('a','studio'),undefined);
});

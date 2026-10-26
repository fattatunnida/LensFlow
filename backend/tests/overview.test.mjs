import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const overview = require('../functions/overview.cjs');
for (const host of [process.env.FIREBASE_AUTH_EMULATOR_HOST, process.env.FIRESTORE_EMULATOR_HOST]) {
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Overview tests require loopback emulators.');
}
const admin = initializeApp({ projectId: 'demo-lensflow' }, 'overview-tests');
const db = getFirestore(admin), studioId = 'overview-test-a', root = db.doc(`studios/${studioId}`);
const now = Date.parse('2026-11-10T10:00:00+07:00'), today = '2026-11-10';
const stamp = ms => Timestamp.fromMillis(ms), request = { studioId }, uid = role => `o6-${role}`;
const codes = code => e => e.code === code;
const inbox = role => root.collection('inboxes').doc(uid(role)).collection('items');
async function seedBooking(id, date, status = 'confirmed', paidAmount = 0, time = '20:00') {
  const startAt = stamp(Date.parse(`${date}T${time}:00+07:00`));
  const value = { code: `BK-${id}`, date, startTime: time, endTime: '21:00', startAt, endAt: stamp(startAt.toMillis()+3600000), clientName: 'Pelanggan uji', packageName: 'Portrait', location: 'Studio', sessionStatus: status, paymentStatus: paidAmount === 500000 ? 'paid' : paidAmount ? 'dp_paid' : 'pending_dp' };
  await root.collection('sessions').doc(id).set(value);
  await root.collection('bookings').doc(id).set({ ...value, total: 500000, paidAmount, refundedAmount: 0, clientPhone: 'PRIVATE', clientEmail: 'PRIVATE', notes: 'PRIVATE' });
}
async function seedEntry(id, kind, amount, effectiveDate = today, createdAt = now-1000) {
  await root.collection('transactions').doc(id).set({ kind, amount, effectiveDate, createdAt: stamp(createdAt), bookingId: 'tomorrow', bookingCode: 'BK-tomorrow' });
}
before(async () => {
  await db.recursiveDelete(root);
  await root.set({ name: 'Overview test', timezone: 'Asia/Jakarta' });
  for (const role of ['owner', 'booking', 'crm', 'payments', 'reports', 'none', 'inactive']) {
    await db.doc(`users/${uid(role)}`).set({ studioId });
    await root.collection('members').doc(uid(role)).set({ role: role === 'owner' ? 'owner' : 'staff', status: role === 'inactive' ? 'inactive' : 'active', createdAt: stamp(now-86400000), permissions: { booking: role === 'booking', calendarCrm: role === 'crm', payments: role === 'payments', reports: role === 'reports' } });
  }
  await seedBooking('today', today); await seedBooking('done', today, 'done', 500000, '08:00'); await seedBooking('cancelled', today, 'cancelled');
  await seedBooking('tomorrow', '2026-11-11', 'confirmed', 150000); await seedBooking('h3', '2026-11-13'); await seedBooking('paid', '2026-11-11', 'confirmed', 500000);
  await seedEntry('dp', 'income_dp', 150000); await seedEntry('settled', 'income_settlement', 50000); await seedEntry('refund', 'refund', 10000); await seedEntry('expense', 'expense', 5000); await seedEntry('yesterday', 'income_dp', 900000, '2026-11-09');
});
after(async () => { await deleteApp(admin); });

test('dashboard uses ledger aggregate, excludes cancellations and redacts financial fields for scheduling roles', async () => {
  const owner = await overview.dashboard(db, uid('owner'), request, now);
  assert.equal(owner.sessionCount, 2); assert.equal(owner.doneCount, 1); assert.equal(owner.cashIn, 200000); assert.equal(owner.refundOut, 10000);
  assert.equal(owner.upcoming.some(s => s.id === 'cancelled'), false);
  assert.equal(JSON.stringify(owner).includes('PRIVATE'), false);
  for (const role of ['booking', 'crm']) {
    const value = await overview.dashboard(db, uid(role), request, now);
    assert.equal(value.canSeeSchedule, true); assert.equal(value.canSeeCash, false); assert.equal('cashIn' in value, false); assert.equal('refundOut' in value, false);
  }
  for (const role of ['payments', 'reports']) {
    const value = await overview.dashboard(db, uid(role), request, now);
    assert.equal(value.cashIn, 200000); assert.equal(value.canSeeSchedule, false); assert.equal('upcoming' in value, false); assert.equal('sessionCount' in value, false);
  }
  const none = await overview.dashboard(db, uid('none'), request, now);
  assert.equal(none.canSeeCash, false); assert.equal(none.canSeeSchedule, false);
});

test('schedule begins at 07 WIB, H-1/H-3 reminders at 09 WIB and paid bookings are excluded', async () => {
  await overview.sync(db, uid('owner'), request, Date.parse(`${today}T06:59:00+07:00`));
  assert.equal((await inbox('owner').get()).size, 0);
  await overview.sync(db, uid('owner'), request, Date.parse(`${today}T07:00:00+07:00`));
  assert.equal((await inbox('owner').get()).size, 1);
  const values = await overview.list(db, uid('owner'), request, now);
  assert.equal(values.items.filter(n => n.kind === 'schedule').length, 1);
  assert.equal(values.items.filter(n => n.kind === 'reminder').length, 2);
  assert.equal(values.items.filter(n => n.kind === 'payment').length, 3);
  assert.equal(values.items.some(n => n.title === 'Pengingat pelunasan H-1' && n.message.includes('350.000')), true);
  assert.equal(JSON.stringify(values).includes('PRIVATE'), false);
});

test('concurrent generation deduplicates each event and repeated read preserves first read time', async () => {
  await Promise.all([overview.sync(db, uid('owner'), request, now), overview.sync(db, uid('owner'), request, now)]);
  assert.equal((await inbox('owner').get()).size, 6);
  const id = overview.eventId('payment', 'dp');
  assert.deepEqual(await overview.mark(db, uid('owner'), { ...request, id }, now), { target: { kind: 'financeEntry', id: 'dp' } });
  const first = (await inbox('owner').doc(id).get()).get('readAt');
  await overview.mark(db, uid('owner'), { ...request, id }, now+1000);
  assert.ok(first.isEqual((await inbox('owner').doc(id).get()).get('readAt')));
});

test('reminders revalidate remaining balance, paid status, cancellations and changed dates', async () => {
  const id = overview.eventId('reminder', 'tomorrow_2026-11-11_1');
  await root.collection('bookings').doc('tomorrow').update({ paidAmount: 200000 });
  assert.ok((await overview.list(db, uid('owner'), request, now)).items.find(n => n.id === id).message.includes('300.000'));
  for (const patch of [{ paidAmount: 500000 }, { paidAmount: 150000, sessionStatus: 'cancelled' }, { sessionStatus: 'confirmed', date: '2026-11-12' }]) {
    await root.collection('bookings').doc('tomorrow').update(patch);
    assert.equal((await overview.list(db, uid('owner'), request, now)).items.some(n => n.id === id), false);
    await assert.rejects(overview.mark(db, uid('owner'), { ...request, id }, now), codes('failed-precondition'));
  }
  await root.collection('bookings').doc('tomorrow').update({ paidAmount: 150000, sessionStatus: 'confirmed', date: '2026-11-11' });
});

test('role withdrawal and business flags immediately hide previously generated financial notifications', async () => {
  const result = await overview.list(db, uid('payments'), request, now);
  assert.equal(result.items.filter(n => n.kind === 'schedule').length, 0); assert.equal(result.items.length, 5);
  const id = result.items[0].id;
  await root.collection('members').doc(uid('payments')).update({ 'permissions.payments': false });
  assert.equal((await overview.list(db, uid('payments'), request, now)).items.length, 0);
  await assert.rejects(overview.mark(db, uid('payments'), { ...request, id }, now), codes('failed-precondition'));
  await root.collection('members').doc(uid('payments')).update({ 'permissions.payments': true });
  await root.update({ inboxEnabled: false });
  assert.equal((await overview.list(db, uid('owner'), request, now)).items.length, 0);
  await root.update({ inboxEnabled: true });
});

test('preferences are versioned, scoped to the caller and cannot grant financial permissions', async () => {
  const initial = await overview.preferences(db, uid('booking'), request, now);
  assert.deepEqual(initial, { schedule: true, payments: true, reminders: true, version: 0 });
  const value = { schedule: false, payments: true, reminders: true };
  assert.equal((await overview.preferences(db, uid('booking'), { ...request, value, expectedVersion: 0 }, now)).version, 1);
  await assert.rejects(overview.preferences(db, uid('booking'), { ...request, value, expectedVersion: 0 }, now), codes('aborted'));
  assert.equal((await overview.list(db, uid('booking'), request, now)).items.length, 0);
  assert.equal((await overview.preferences(db, uid('owner'), request, now)).version, 0);
  await assert.rejects(overview.preferences(db, uid('owner'), { ...request, value: { ...value, reminders: 'true' }, expectedVersion: 0 }, now), codes('invalid-argument'));
});

test('payment toggle does not backfill payments received while notifications were disabled', async () => {
  await overview.preferences(db, uid('payments'), { ...request, value: { schedule: true, payments: false, reminders: true }, expectedVersion: 0 }, now);
  await seedEntry('while-disabled', 'income_dp', 10000, today, now+1000);
  await overview.preferences(db, uid('payments'), { ...request, value: { schedule: true, payments: true, reminders: true }, expectedVersion: 1 }, now+2000);
  await seedEntry('after-enabled', 'income_dp', 20000, today, now+3000);
  const page = await overview.list(db, uid('payments'), request, now+4000);
  assert.equal(page.items.some(n => n.target.id === 'while-disabled'), false);
  assert.equal(page.items.some(n => n.target.id === 'after-enabled'), true);
});

test('payment and inbox cursors preserve same-timestamp events across batches and pages', async () => {
  for (let i = 0; i < 28; i++) await seedEntry(`bulk-${String(i).padStart(2, '0')}`, 'income_dp', 1000, today, now+5000);
  let generated = await overview.sync(db, uid('owner'), request, now+6000);
  assert.equal(generated.pending, true);
  await overview.sync(db, uid('owner'), request, now+6000);
  let page = await overview.list(db, uid('owner'), request, now+6000), ids = page.items.map(n => n.id);
  assert.equal(page.items.length, 25); assert.ok(page.next);
  page = await overview.list(db, uid('owner'), { ...request, next: page.next }, now+6000); ids.push(...page.items.map(n => n.id));
  assert.equal(new Set(ids).size, ids.length); assert.equal(ids.filter(id => id.startsWith('payment_')).length, 33);
});

test('retention removes old events from list and rejects expired or foreign mark requests', async () => {
  const old = now-31*86400000;
  await seedEntry('expired-entry', 'income_dp', 999, today, old);
  const id = overview.eventId('payment', 'expired-entry');
  await inbox('owner').doc(id).set({ kind: 'payment', entryId: 'expired-entry', createdAt: stamp(old), readAt: null });
  assert.equal((await overview.list(db, uid('owner'), request, now)).items.some(n => n.id === id), false);
  await assert.rejects(overview.mark(db, uid('owner'), { ...request, id }, now), codes('not-found'));
  await assert.rejects(overview.mark(db, uid('none'), { ...request, id: overview.eventId('payment', 'dp') }, now), codes('not-found'));
});

test('inactive, anonymous, cross-studio and caller/clock injection are rejected', async () => {
  await assert.rejects(overview.dashboard(db, null, request, now), codes('unauthenticated'));
  await assert.rejects(overview.dashboard(db, uid('inactive'), request, now), codes('permission-denied'));
  await assert.rejects(overview.dashboard(db, uid('owner'), { studioId: 'overview-test-b' }, now), codes('permission-denied'));
  for (const extra of [{ uid: uid('owner') }, { now }, { permissions: { payments: true } }]) await assert.rejects(overview.list(db, uid('none'), { ...request, ...extra }, now), codes('invalid-argument'));
  await assert.rejects(overview.list(db, uid('owner'), { ...request, next: ['invalid'] }, now), codes('invalid-argument'));
});

test('bounded worker resumes member checkpoint and repeated full runs do not duplicate events', async () => {
  let result = await overview.dispatch(db, { studioIds: [studioId], maxUsers: 2, now });
  assert.equal(result.pending, true); let runs = 1;
  while (result.pending && runs++ < 10) result = await overview.dispatch(db, { studioIds: [studioId], maxUsers: 2, now });
  assert.equal(result.pending, false);
  const count = (await inbox('owner').get()).size;
  await overview.dispatch(db, { studioIds: [studioId], now });
  assert.equal((await inbox('owner').get()).size, count);
});

import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getFirebaseClient } from '../../src/lib/firebase/client.ts';
import { readDashboard, readInbox, openInboxItem, readInboxPreferences, saveInboxPreferences } from '../../src/features/overview/repository.ts';
const require = createRequire(import.meta.url);
const { signInWithEmailAndPassword } = require('firebase/auth');
const { getApp, deleteApp: deleteSdk } = require('firebase/app');
const { doc, getDocFromServer, setDoc } = require('firebase/firestore');
const { httpsCallable } = require('firebase/functions');
for (const host of [process.env.FIREBASE_AUTH_EMULATOR_HOST, process.env.FIRESTORE_EMULATOR_HOST]) if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('SDK tests require loopback emulators.');
globalThis.__DEV__ = true;
Object.assign(process.env, { EXPO_PUBLIC_FIREBASE_USE_EMULATORS: 'true', EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1', EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT: '9099', EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT: '8082', EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT: '5001' });
const admin = initializeApp({ projectId: 'demo-lensflow' }, 'overview-sdk-tests'), db = getFirestore(admin), auth = getAuth(admin), studioId = 'overview-sdk-test', uid = 'o6-app-sdk', root = db.doc(`studios/${studioId}`);
const denied = e => ['permission-denied', 'functions/permission-denied'].includes(e.code);
before(async () => {
  await db.recursiveDelete(root);
  try { await auth.getUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; await auth.createUser({ uid, email: `${uid}@lensflow.test`, password: 'OverviewTests2026!' }); }
  await db.doc(`users/${uid}`).set({ studioId, displayName: 'SDK Owner', email: `${uid}@lensflow.test` });
  await root.set({ name: 'Overview SDK', timezone: 'Asia/Jakarta' });
  await root.collection('members').doc(uid).set({ role: 'owner', status: 'active', permissions: { booking: true, calendarCrm: true, payments: true, reports: true } });
  const today = new Date(Date.now()+7*3600000).toISOString().slice(0, 10);
  await root.collection('transactions').doc('sdk-dp').set({ kind: 'income_dp', amount: 175000, effectiveDate: today, createdAt: Timestamp.fromMillis(Date.now()-1000), bookingId: 'sdk-booking', bookingCode: 'BK-SDK' });
  await signInWithEmailAndPassword(getFirebaseClient().auth, `${uid}@lensflow.test`, 'OverviewTests2026!');
});
after(async () => { await deleteSdk(getApp()); await deleteApp(admin); });
test('application repository calls dashboard/inbox/read/preferences using the shared Firebase client', async () => {
  assert.equal((await readDashboard(studioId)).cashIn, 175000);
  const page = await readInbox(studioId), item = page.items.find(n => n.kind === 'payment');
  assert.ok(item); assert.equal(typeof item.createdAt, 'number'); assert.equal(item.readAt, null);
  assert.deepEqual(await openInboxItem(studioId, item.id), { target: { kind: 'financeEntry', id: 'sdk-dp' } });
  assert.equal(typeof (await readInbox(studioId)).items.find(n => n.id === item.id).readAt, 'number');
  const prefs = await readInboxPreferences(studioId);
  assert.equal((await saveInboxPreferences(studioId, { schedule: true, payments: false, reminders: true }, prefs.version)).version, 1);
  assert.equal((await readInbox(studioId)).items.some(n => n.kind === 'payment'), false);
});
test('inbox, sync state and preferences cannot be read or forged directly, including by owner', async () => {
  const client = getFirebaseClient();
  for (const path of [`inboxes/${uid}/items/forged`, `inboxPreferences/${uid}`, `inboxSyncState/${uid}`]) {
    const ref = doc(client.db, `studios/${studioId}/${path}`);
    await assert.rejects(getDocFromServer(ref), denied); await assert.rejects(setDoc(ref, { payments: true, amount: 1 }), denied);
  }
  await assert.rejects(httpsCallable(client.functions, 'inboxList')({ studioId, uid: 'another-user' }), e => e.code === 'functions/invalid-argument');
  await assert.rejects(readDashboard('overview-other-studio'), denied);
});
test('server rechecks withdrawn financial access and inactive membership on every call', async () => {
  await root.collection('members').doc(uid).update({ role: 'staff', permissions: { booking: true, calendarCrm: false, payments: false, reports: false } });
  const value = await readDashboard(studioId);
  assert.equal(value.canSeeSchedule, true); assert.equal('cashIn' in value, false); assert.equal('refundOut' in value, false);
  await root.collection('members').doc(uid).update({ status: 'inactive' });
  await assert.rejects(readDashboard(studioId), denied); await assert.rejects(readInbox(studioId), denied);
});

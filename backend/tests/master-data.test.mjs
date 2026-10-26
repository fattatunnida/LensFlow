import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
// tsx loads this project's .ts repository through the CJS export condition.
// Keep SDK instances on that same condition; ESM/CJS Firestore classes differ.
const require = createRequire(import.meta.url);
const { initializeApp, deleteApp } = require('firebase/app');
const { connectAuthEmulator, getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { collection, connectFirestoreEmulator, deleteDoc, doc, getDocFromServer, getDocs, getFirestore, limit, query, serverTimestamp, setDoc, updateDoc } = require('firebase/firestore');
import { duplicateClients, PAGE_SIZE, readMaster, readMasterPage, saveMaster } from '../../src/features/master-data/repository.ts';
import { validateClient, validatePackage } from '../../src/features/master-data/validation.ts';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Use emulators for these tests.');
for (const host of [process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST]) if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Master tests require loopback emulators.');
const projectId = 'demo-lensflow';
const admin = initializeAdmin({ projectId }, 'master-tests-admin');
const dbAdmin = adminFirestore(admin), authAdmin = adminAuth(admin);
const clients = {}, apps = [];
const baseClient = validateClient({ name: 'Rina Amelia', phone: '081234567890', email: '', address: '', notes: '', leadSource: '' }).value;
const basePackage = validatePackage({ name: 'Portrait', price: '500000', durationMinutes: '60', editedPhotosCount: '10', defaultLocation: 'Studio A', description: '', isActive: true }).value;
const denied = (error) => error.code === 'permission-denied';
const conflict = (error) => error.reason === 'conflict';

before(async () => {
  for (const studioId of ['master-test-a', 'master-test-b']) await dbAdmin.recursiveDelete(dbAdmin.doc(`studios/${studioId}`));
  for (const [role, flags] of Object.entries({ owner: [true,true], crm: [true,false], booking: [false,true], none: [false,false], inactive: [true,true], other: [true,true] })) {
    const uid = `m3-${role}`, studioId = role === 'other' ? 'master-test-b' : 'master-test-a';
    try { await authAdmin.getUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; await authAdmin.createUser({ uid, email: `${uid}@lensflow.test`, password: 'MasterTests2026!' }); }
    await dbAdmin.doc(`studios/${studioId}`).set({ name: studioId });
    await dbAdmin.doc(`studios/${studioId}/members/${uid}`).set({ role: ['owner','other'].includes(role) ? 'owner' : 'staff', status: role === 'inactive' ? 'inactive' : 'active', permissions: { calendarCrm: flags[0], booking: flags[1], payments: false, reports: false } });
    const app = initializeApp({ projectId, apiKey: 'demo-key' }, `master-${role}`); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const db = getFirestore(app), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':'); connectFirestoreEmulator(db, host, Number(port));
    await signInWithEmailAndPassword(auth, `${uid}@lensflow.test`, 'MasterTests2026!');
    clients[role] = { db, actor: { uid, studioId, role: ['owner','other'].includes(role) ? 'owner' : 'staff', crm: flags[0], booking: flags[1] } };
  }
});
after(async () => { await Promise.all(apps.map(deleteApp)); await deleteAdmin(admin); });
function path(kind, id) { return `studios/master-test-a/${kind}/${id}`; }
function rawMeta(uid) { return { createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: uid, updatedBy: uid, version: 1, mutationId: 'raw-mutation-0001' }; }

test('owner and CRM staff create/read/update customers using the application repository', async () => {
  const { db, actor } = clients.owner;
  await saveMaster(db, actor, 'clients', 'customer-main', null, baseClient, 'client-create-0001');
  const record = await readMaster(clients.crm.db, clients.crm.actor, 'clients', 'customer-main');
  assert.equal(record.phone, '+6281234567890'); assert.equal(record.version, 1); assert.ok(record.createdAt > 0);
  await saveMaster(clients.crm.db, clients.crm.actor, 'clients', record.id, record.version, { ...baseClient, notes: 'Updated by CRM' }, 'client-update-0001');
  const updated = await readMaster(db, actor, 'clients', record.id);
  assert.equal(updated.createdBy, actor.uid); assert.equal(updated.updatedBy, clients.crm.actor.uid); assert.equal(updated.version, 2);
});

test('customer contacts stay isolated and insufficient or inactive memberships are denied by Rules', async () => {
  for (const role of ['booking','none','inactive','other']) {
    await assert.rejects(getDocFromServer(doc(clients[role].db, path('clients','customer-main'))), denied);
    await assert.rejects(setDoc(doc(clients[role].db, path('clients',`forged-${role}`)), { ...baseClient, ...rawMeta(clients[role].actor.uid) }), denied);
  }
  const anonymousApp = initializeApp({ projectId, apiKey: 'demo-key' }, 'master-anonymous'); apps.push(anonymousApp);
  const db = getFirestore(anonymousApp), [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':'); connectFirestoreEmulator(db, host, Number(port));
  await assert.rejects(getDocFromServer(doc(db, path('clients','customer-main'))), denied);
});

test('customer schema, immutable metadata and version increments cannot be bypassed', async () => {
  const { db, actor } = clients.owner;
  const ref = doc(db, path('clients','customer-main'));
  for (const fields of [{ phone: '081234567890' }, { email: 'broken' }, { nameKey: 'forged' }, { createdBy: 'forged' }, { notes: 'x'.repeat(2001) }, { totalBookings: 100 }]) {
    await assert.rejects(updateDoc(ref, { ...fields, version: 3, mutationId: 'raw-update-00002', updatedAt: serverTimestamp(), updatedBy: actor.uid }), denied);
  }
  await assert.rejects(updateDoc(ref, { notes: 'without version', updatedAt: serverTimestamp(), updatedBy: actor.uid }), denied);
  await assert.rejects(deleteDoc(ref), denied);
});

test('retries are idempotent and stale edits cannot overwrite another writer', async () => {
  const { db, actor } = clients.owner;
  const first = await saveMaster(db, actor, 'clients', 'customer-retry', null, baseClient, 'client-retry-0001');
  assert.deepEqual(await saveMaster(db, actor, 'clients', 'customer-retry', null, baseClient, 'client-retry-0001'), first);
  await assert.rejects(saveMaster(db, actor, 'clients', 'customer-retry', null, { ...baseClient, notes: 'different' }, 'client-retry-0001'), conflict);
  await saveMaster(db, actor, 'clients', 'customer-retry', 1, { ...baseClient, notes: 'one change' }, 'client-retry-0002');
  await assert.rejects(saveMaster(db, actor, 'clients', 'customer-retry', 1, { ...baseClient, notes: 'stale change' }, 'client-retry-0003'), conflict);
  assert.equal((await readMaster(db, actor, 'clients', 'customer-retry')).notes, 'one change');
});

test('duplicate-phone warning lookup excludes the customer currently being edited', async () => {
  const { db, actor } = clients.owner;
  assert.ok((await duplicateClients(db, actor, baseClient.phone)).length >= 2);
  const unique = { ...baseClient, phone: '+6289876543210', name: 'Unique contact', nameKey: 'unique contact' };
  await saveMaster(db, actor, 'clients', 'unique-contact', null, unique, 'unique-contact-001');
  assert.deepEqual(await duplicateClients(db, actor, unique.phone, 'unique-contact'), []);
  assert.deepEqual(await duplicateClients(db, actor, unique.phone), ['Unique contact']);
});

test('customer pagination and normalized phone/name prefix search use bounded server queries', async () => {
  const { db, actor } = clients.owner;
  for (let index = 0; index < PAGE_SIZE + 2; index++) {
    const name = `Page ${String(index).padStart(2,'0')}`;
    await saveMaster(db, actor, 'clients', `page-${index}`, null, { ...baseClient, name, nameKey: name.toLowerCase(), phone: `+6281111100${String(index).padStart(2,'0')}` }, `page-client-${String(index).padStart(4,'0')}`);
  }
  const first = await readMasterPage(db, actor, 'clients', 'page');
  assert.equal(first.items.length, PAGE_SIZE); assert.equal(first.hasMore, true);
  const next = await readMasterPage(db, actor, 'clients', 'page', 'all', first.cursor);
  assert.equal(next.items.length, 2); assert.equal(next.hasMore, false);
  assert.equal(new Set([...first.items,...next.items].map((item) => item.id)).size, PAGE_SIZE + 2);
  const phone = await readMasterPage(db, actor, 'clients', '08111110000');
  assert.equal(phone.items[0].id, 'page-0');
  await assert.rejects(getDocs(collection(db, 'studios/master-test-a/clients')), denied);
});

test('only owners manage packages; booking staff see active packages and no inactive records', async () => {
  const { db, actor } = clients.owner;
  await saveMaster(db, actor, 'packages', 'portrait', null, basePackage, 'package-create-001');
  await saveMaster(db, actor, 'packages', 'inactive', null, { ...basePackage, name: 'Inactive', nameKey: 'inactive', isActive: false }, 'package-create-002');
  const staff = clients.booking;
  assert.equal((await readMasterPage(staff.db, staff.actor, 'packages', '', 'active')).items[0].id, 'portrait');
  await assert.rejects(getDocFromServer(doc(staff.db, path('packages','inactive'))), denied);
  await assert.rejects(getDocs(query(collection(staff.db, 'studios/master-test-a/packages'), limit(26))), denied);
  for (const role of ['booking','crm','none','inactive','other']) await assert.rejects(setDoc(doc(clients[role].db, path('packages',`attempt-${role}`)), { ...basePackage, ...rawMeta(clients[role].actor.uid) }), denied);
  await assert.rejects(getDocFromServer(doc(clients.crm.db, path('packages','portrait'))), denied);
});

test('package validation rejects invalid price/duration/flags and preserves old booking snapshots', async () => {
  const { db, actor } = clients.owner;
  const ref = doc(db, path('packages','portrait'));
  for (const fields of [{ price: 0 }, { price: -1 }, { price: 1.5 }, { durationMinutes: 0 }, { durationMinutes: 1441 }, { editedPhotosCount: -1 }, { isActive: 'yes' }, { unknown: true }]) await assert.rejects(updateDoc(ref, { ...fields, version: 2, mutationId: 'package-invalid-001', updatedBy: actor.uid, updatedAt: serverTimestamp() }), denied);
  const snapshot = { name: basePackage.name, price: basePackage.price, durationMinutes: basePackage.durationMinutes };
  const booking = dbAdmin.doc('studios/master-test-a/bookings/snapshot-fixture');
  await booking.set({ packageSnapshot: snapshot });
  await saveMaster(db, actor, 'packages', 'portrait', 1, { ...basePackage, price: 650000, isActive: false }, 'package-update-001');
  assert.deepEqual((await booking.get()).data().packageSnapshot, snapshot);
  assert.equal((await readMasterPage(clients.booking.db, clients.booking.actor, 'packages', '', 'active')).items.length, 0);
  await assert.rejects(deleteDoc(ref), denied);
});

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDocFromServer, getDocs, getFirestore, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { provisionOwner } from '../scripts/provision.mjs';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Tests require Firebase emulators.');
const projectId = 'demo-lensflow';
const admin = initializeAdmin({ projectId }, 'auth-tests-admin');
const adminDb = getAdminFirestore(admin);
const adminAuth = getAdminAuth(admin);
const apps = [];
let sequence = 0;
function client() {
  const app = initializeApp({ apiKey: 'demo-key', projectId }, `test-${sequence++}`); apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(db, host, Number(port));
  return { auth, db };
}
const password = 'IntegrationOnly2026!';
const permissions = { booking: true, calendarCrm: true, payments: false, reports: false };
before(async () => {
  for (const uid of ['owner-a', 'staff-a', 'inactive-a', 'owner-b', 'unprovisioned']) {
    try { await adminAuth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    await adminAuth.createUser({ uid, email: `${uid}@lensflow.test`, password });
    if (uid === 'unprovisioned') continue;
    const studioId = uid === 'owner-b' ? 'test-studio-b' : 'test-studio-a';
    await adminDb.doc(`users/${uid}`).set({ displayName: uid, email: `${uid}@lensflow.test`, studioId });
    await adminDb.doc(`studios/${studioId}`).set({ name: studioId, timezone: 'Asia/Jakarta' });
    await adminDb.doc(`studios/${studioId}/members/${uid}`).set({ role: uid.startsWith('owner') ? 'owner' : 'staff', status: uid.startsWith('inactive') ? 'inactive' : 'active', permissions });
  }
});
after(async () => { await Promise.all(apps.map(deleteApp)); await deleteAdmin(admin); });
const denied = (error) => error.code === 'permission-denied';

test('unauthenticated clients cannot read studio or profile', async () => {
  const { db } = client();
  await assert.rejects(getDocFromServer(doc(db, 'users/owner-a')), denied);
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-a')), denied);
});
test('valid owner can authenticate and read own provisioned context', async () => {
  const { auth, db } = client();
  const result = await signInWithEmailAndPassword(auth, 'owner-a@lensflow.test', password);
  assert.equal(result.user.uid, 'owner-a');
  assert.equal((await getDocFromServer(doc(db, 'users/owner-a'))).data().studioId, 'test-studio-a');
  assert.equal((await getDocFromServer(doc(db, 'studios/test-studio-a/members/owner-a'))).data().role, 'owner');
  assert.equal((await getDocFromServer(doc(db, 'studios/test-studio-a'))).data().name, 'test-studio-a');
});
test('wrong password is rejected', async () => {
  const { auth } = client();
  await assert.rejects(signInWithEmailAndPassword(auth, 'owner-a@lensflow.test', 'wrong-password'), (error) => ['auth/wrong-password', 'auth/invalid-credential'].includes(error.code));
  assert.equal(auth.currentUser, null);
});
test('a valid Firebase account without membership cannot access studio data', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'unprovisioned@lensflow.test', password);
  assert.equal((await getDocFromServer(doc(db, 'users/unprovisioned'))).exists(), false);
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-a')), denied);
});
test('inactive membership denies studio access even with valid credentials', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'inactive-a@lensflow.test', password);
  assert.equal((await getDocFromServer(doc(db, 'studios/test-studio-a/members/inactive-a'))).data().status, 'inactive');
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-a')), denied);
});
test('staff can read own context but cannot read another user or studio', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'staff-a@lensflow.test', password);
  assert.ok((await getDocFromServer(doc(db, 'studios/test-studio-a'))).exists());
  await assert.rejects(getDocFromServer(doc(db, 'users/owner-a')), denied);
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-b')), denied);
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-a/members/owner-a')), denied);
});
test('a client cannot promote itself, reassign its studio, or change business data', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'staff-a@lensflow.test', password);
  await assert.rejects(updateDoc(doc(db, 'studios/test-studio-a/members/staff-a'), { role: 'owner' }), denied);
  await assert.rejects(updateDoc(doc(db, 'users/staff-a'), { studioId: 'test-studio-b' }), denied);
  await assert.rejects(setDoc(doc(db, 'studios/test-studio-b/members/staff-a'), { role: 'owner', status: 'active' }), denied);
  await assert.rejects(updateDoc(doc(db, 'studios/test-studio-a'), { name: 'Unauthorized edit' }), denied);
});
test('users and member collection listing are closed', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'owner-a@lensflow.test', password);
  await assert.rejects(getDocs(collection(db, 'users')), denied);
  await assert.rejects(getDocs(collection(db, 'studios/test-studio-a/members')), denied);
});
test('future booking and payment collections are closed by default', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'owner-a@lensflow.test', password);
  await assert.rejects(setDoc(doc(db, 'studios/test-studio-a/bookings/booking-a'), { total: 100 }), denied);
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-a/payments/payment-a')), denied);
});
test('membership revocation is observable and immediately blocks subsequent server reads', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'staff-a@lensflow.test', password);
  const ref = doc(db, 'studios/test-studio-a/members/staff-a');
  const observed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('membership listener timeout')); }, 5000);
    const stop = onSnapshot(ref, (snapshot) => {
      if (!snapshot.metadata.fromCache && snapshot.data()?.status === 'inactive') { clearTimeout(timer); stop(); resolve(); }
    }, reject);
  });
  await adminDb.doc(ref.path).update({ status: 'inactive' });
  await observed;
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-a')), denied);
  await adminDb.doc(ref.path).update({ status: 'active' });
});
test('logout removes the local user and blocks new protected reads', async () => {
  const { auth, db } = client(); await signInWithEmailAndPassword(auth, 'owner-a@lensflow.test', password);
  await signOut(auth); assert.equal(auth.currentUser, null);
  await assert.rejects(getDocFromServer(doc(db, 'studios/test-studio-a')), denied);
});
test('password reset request generates an emulator out-of-band email', async () => {
  const { auth } = client(); await sendPasswordResetEmail(auth, 'owner-a@lensflow.test');
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/oobCodes`);
  const result = await response.json();
  assert.ok(result.oobCodes.some((entry) => entry.email === 'owner-a@lensflow.test' && entry.requestType === 'PASSWORD_RESET'));
});
test('owner provisioning is repeatable without duplicate users or a second owner', async () => {
  const config = { projectId, email: 'provision-owner@lensflow.test', password, displayName: 'Owner', studioId: 'provision-studio', studioName: 'Provision Studio' };
  const uid = await provisionOwner(config);
  assert.equal(await provisionOwner(config), uid);
  assert.equal((await adminDb.doc('studios/provision-studio').get()).data().ownerUid, uid);
  await assert.rejects(provisionOwner({ ...config, email: 'second-owner@lensflow.test' }), /owner kedua/);
  await assert.rejects(adminAuth.getUserByEmail('second-owner@lensflow.test'), (error) => error.code === 'auth/user-not-found');
});
test('provisioning cannot silently elevate an existing staff member', async () => {
  await assert.rejects(provisionOwner({ projectId, email: 'staff-a@lensflow.test', password, displayName: 'Staff', studioId: 'test-studio-a', studioName: 'Studio A' }), /peran lain/);
  assert.equal((await adminDb.doc('studios/test-studio-a/members/staff-a').get()).data().role, 'staff');
});

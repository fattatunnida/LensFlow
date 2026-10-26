import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export async function provisionOwner({ projectId, email, password, displayName, studioId, studioName }) {
  const app = getApps().find((candidate) => candidate.options.projectId === projectId)
    ?? initializeApp({ projectId }, projectId);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let user;
  let createdUser = false;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  if (user) {
    const [profile, membership] = await Promise.all([
      db.doc(`users/${user.uid}`).get(),
      db.doc(`studios/${studioId}/members/${user.uid}`).get(),
    ]);
    // Never silently move an existing user or promote an existing staff account.
    if ((profile.exists && profile.data().studioId !== studioId)
      || (membership.exists && membership.data().role !== 'owner')) {
      throw new Error('Akun sudah terikat ke studio atau peran lain. Periksa secara manual.');
    }
  }
  const studioBefore = await db.doc(`studios/${studioId}`).get();
  if (studioBefore.exists && studioBefore.data().ownerUid !== user?.uid) {
    throw new Error('Studio sudah ada dan bukan milik akun ini. Provisioning tidak menambahkan owner kedua.');
  }
  if (!user) {
    user = await auth.createUser({ email, password, displayName, emailVerified: true });
    createdUser = true;
  }

  try {
  await db.runTransaction(async (transaction) => {
    const studioRef = db.doc(`studios/${studioId}`);
    const studio = await transaction.get(studioRef);
    if (studio.exists && studio.data().ownerUid !== user.uid) {
      throw new Error('Studio sudah memiliki owner lain.');
    }
    if (!studio.exists) {
      transaction.set(studioRef, {
        name: studioName,
        ownerUid: user.uid,
        timezone: 'Asia/Jakarta',
        clientBackendVersion: 1,
        openingTime: '08:00', closingTime: '21:00', defaultDpPercent: 30,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.set(db.doc(`users/${user.uid}`), {
      displayName, email: user.email, studioId, updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.doc(`studios/${studioId}/members/${user.uid}`), {
      role: 'owner', status: 'active',
      displayName, email: user.email,
      permissions: { booking: true, calendarCrm: true, payments: true, reports: true },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  } catch (error) {
    if (createdUser) await auth.deleteUser(user.uid).catch(() => {});
    throw error;
  }
  return user.uid;
}

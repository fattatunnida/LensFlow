// This script intentionally refuses to target a cloud Firebase project.
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
for (const host of [authHost, firestoreHost]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
    throw new Error('Seed demo hanya boleh memakai emulator pada loopback komputer ini.');
  }
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
const { provisionOwner } = await import('./provision.mjs');
await provisionOwner({
  projectId: 'demo-lensflow', email: 'owner@lensflow.test',
  password: 'LensFlowDemo2026!', displayName: 'Andi Pratama',
  studioId: 'studio-cahaya', studioName: 'Studio Cahaya',
});
console.log('Owner emulator siap: owner@lensflow.test / LensFlowDemo2026!');
console.log('Akun demo hanya untuk pengujian lokal.');
const { getApps, deleteApp } = await import('firebase-admin/app');
await Promise.all(getApps().map(deleteApp));

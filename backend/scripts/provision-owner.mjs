// Cloud provisioning uses Application Default Credentials. Never copy a private
// service account key into the mobile app or an EXPO_PUBLIC environment value.
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Gunakan npm run backend:seed untuk emulator.');
}
const config = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  email: process.env.OWNER_EMAIL,
  password: process.env.OWNER_INITIAL_PASSWORD,
  displayName: process.env.OWNER_NAME,
  studioId: process.env.STUDIO_ID,
  studioName: process.env.STUDIO_NAME,
};
for (const [field, value] of Object.entries(config)) {
  if (!value?.trim()) throw new Error(`Environment backend belum lengkap: ${field}`);
}
if (config.projectId.startsWith('demo-') || !/^[a-z0-9-]+$/.test(config.studioId)) {
  throw new Error('Project ID cloud atau studio ID tidak valid.');
}
if (config.password.length < 12) throw new Error('Password awal minimal 12 karakter.');
if (process.env.CONFIRM_FIREBASE_PROJECT !== config.projectId) {
  throw new Error('Set CONFIRM_FIREBASE_PROJECT sama dengan FIREBASE_PROJECT_ID untuk memilih target secara eksplisit.');
}
const { provisionOwner } = await import('./provision.mjs');
const uid = await provisionOwner(config);
console.log(`Owner berhasil diprovision. UID: ${uid}. Password tidak ditampilkan.`);
const { getApps, deleteApp } = await import('firebase-admin/app');
await Promise.all(getApps().map(deleteApp));

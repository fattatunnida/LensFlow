import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { authPersistence } from './auth-persistence';

type FirebaseClient = { auth: Auth; db: Firestore; emulator: boolean };
let client: FirebaseClient | undefined;

export function getFirebaseClient(): FirebaseClient {
  if (client) return client;
  const emulator = __DEV__ && process.env.EXPO_PUBLIC_FIREBASE_USE_EMULATORS !== 'false';
  const config = emulator ? {
    apiKey: 'demo-lensflow-api-key', projectId: 'demo-lensflow',
    authDomain: 'demo-lensflow.firebaseapp.com', appId: '1:123456789:web:lensflow',
  } : {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error('Konfigurasi Firebase belum lengkap. Periksa .env sesuai README.');
  }
  const existing = getApps().some(app=>app.name==='[DEFAULT]');
  const app = existing ? getApp() : initializeApp(config);
  // Fast refresh reuses the existing Auth and emulator connections.
  const auth = existing ? getAuth(app) : initializeAuth(app, { persistence: authPersistence });
  const db = getFirestore(app);
  if (emulator && !existing) {
    const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:${process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || '9099'}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, Number(process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || '8082'));
  }
  auth.languageCode = 'id';
  client = { auth, db, emulator };
  return client;
}

import * as FirebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { createChunkedStorage, type AsyncKeyValueStore } from '../auth/chunked-storage';

// Firebase's top-level declaration selects its web exports even when Metro
// selects the documented native export at runtime. Keep this cast native-only.
const { getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence(storage: AsyncKeyValueStore): Persistence;
};

const storage = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});

export const authPersistence = getReactNativePersistence(storage);

import * as SecureStore from 'expo-secure-store';

const key = 'lensflow.login.email';

export async function readRememberedEmail(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); }
  catch { return null; }
}

export async function saveRememberedEmail(email: string | null): Promise<void> {
  try {
    if (email) await SecureStore.setItemAsync(key, email);
    else await SecureStore.deleteItemAsync(key);
  } catch { /* A blocked preference store must not prevent login. */ }
}

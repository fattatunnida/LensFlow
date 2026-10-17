const key = 'lensflow.login.email';

export async function readRememberedEmail(): Promise<string | null> {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); }
  catch { return null; }
}

export async function saveRememberedEmail(email: string | null): Promise<void> {
  try {
    if (typeof localStorage === 'undefined') return;
    if (email) localStorage.setItem(key, email);
    else localStorage.removeItem(key);
  } catch { /* A blocked preference store must not prevent login. */ }
}

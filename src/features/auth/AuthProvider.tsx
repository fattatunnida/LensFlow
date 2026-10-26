import { onIdTokenChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { AccessDeniedError, parseSession, type StudioSession } from '@/lib/auth/session';
import { normalizeEmail } from '@/lib/auth/validation';
import { getFirebaseClient } from '@/lib/firebase/client';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; message?: string }
  | { status: 'authenticated'; session: StudioSession }
  | { status: 'unavailable'; message: string };

type AuthContextValue = {
  state: AuthState;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  retry(): void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

function withTimeout<T>(request: Promise<T>, milliseconds = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Batas waktu koneksi terlampaui.')), milliseconds);
    request.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [configuration] = useState(() => {
    try { return { client: getFirebaseClient(), error: null }; }
    catch { return { client: null, error: 'Aplikasi belum terhubung dengan layanan studio. Hubungi admin untuk menyelesaikan pengaturan.' }; }
  });
  const [state, setState] = useState<AuthState>(() => configuration.client
    ? { status: 'loading' }
    : { status: 'unavailable', message: configuration.error! });
  const [attempt, setAttempt] = useState(0);
  const signedOutMessage = useRef<string | undefined>(undefined);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!configuration.client) return;
    let stopped = false;
    let generation = 0;
    let stopMembership: Unsubscribe | undefined;
    let stopProfile: Unsubscribe | undefined;
    let stopStudio: Unsubscribe | undefined;
    let stopAuth: Unsubscribe | undefined;
    let stopForeground: { remove(): void } | undefined;
    let authenticatedUid: string | null = null;
    const alive = (version: number) => !stopped && generation === version;

      const { auth, db } = configuration.client;
      const check = async (user: User | null, blocking = false) => {
        const version = ++generation;
        stopMembership?.();
        stopProfile?.();
        stopStudio?.();
        stopMembership = undefined;
        if (!user) {
          authenticatedUid = null;
          if (!stopped) setState({ status: 'signedOut', message: signedOutMessage.current });
          return;
        }
        // Credential refresh for the same identity must preserve form navigation.
        // Startup and foreground checks still block until server access is known.
        if (blocking || authenticatedUid !== user.uid) setState({ status: 'loading' });
        try {
          const profileDoc = await withTimeout(getDocFromServer(doc(db, 'users', user.uid)));
          if (!alive(version)) return;
          const profile = profileDoc.data();
          if (!profile || typeof profile.studioId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(profile.studioId)) {
            throw new AccessDeniedError();
          }
          const memberRef = doc(db, 'studios', profile.studioId, 'members', user.uid);
          const member = await withTimeout(getDocFromServer(memberRef));
          if (!alive(version)) return;
          if (member.data()?.status !== 'active') throw new AccessDeniedError();
          const studio = await withTimeout(getDocFromServer(doc(db, 'studios', profile.studioId)));
          if (!alive(version)) return;
          const session = parseSession(user.uid, profile, member.data(), studio.data());
          authenticatedUid = user.uid;
          setState({ status: 'authenticated', session });

          let latestProfile: Record<string, unknown> | undefined = profile;
          let latestStudio = studio.data(), latestMember = member.data();
          const emitMetadata = () => {
            if (!alive(version)) return;
            try { setState({ status: 'authenticated', session: parseSession(user.uid, latestProfile, latestMember, latestStudio) }); }
            catch { setState({ status: 'unavailable', message: 'Data akun berubah. Periksa koneksi dan muat ulang akses studio.' }); }
          };
          const metadataError = () => { if (alive(version)) setState({ status: 'unavailable', message: 'Data akun belum dapat diperbarui. Silakan coba lagi.' }); };
          stopProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => { if (alive(version) && !snapshot.metadata.fromCache) { latestProfile = snapshot.data(); emitMetadata(); } }, metadataError);
          stopStudio = onSnapshot(doc(db, 'studios', profile.studioId), snapshot => { if (alive(version) && !snapshot.metadata.fromCache) { latestStudio = snapshot.data(); emitMetadata(); } }, metadataError);

          stopMembership = onSnapshot(memberRef, (snapshot) => {
            if (!alive(version) || snapshot.metadata.fromCache) return;
            try {
              latestMember = snapshot.data();
              const latest = parseSession(user.uid, latestProfile, latestMember, latestStudio);
              setState({ status: 'authenticated', session: latest });
            } catch {
              signedOutMessage.current = 'Akses akun Anda telah dinonaktifkan. Hubungi pemilik studio.';
              setState({ status: 'loading' });
              void firebaseSignOut(auth).catch(() => {
                if (alive(version)) setState({ status: 'unavailable', message: 'Sesi belum berhasil dibersihkan. Coba keluar kembali.' });
              });
            }
          }, () => {
            if (alive(version)) setState({ status: 'unavailable', message: 'Akses studio belum dapat diperiksa. Silakan coba lagi.' });
          });
        } catch (error) {
          if (!alive(version)) return;
          const permissionDenied = typeof error === 'object' && error && 'code' in error && error.code === 'permission-denied';
          if (error instanceof AccessDeniedError || permissionDenied) {
            signedOutMessage.current = 'Akun belum memiliki akses aktif ke studio. Hubungi pemilik studio.';
            setState({ status: 'loading' });
            await firebaseSignOut(auth).catch(() => {
              if (alive(version)) setState({ status: 'unavailable', message: 'Sesi belum berhasil dibersihkan. Coba keluar kembali.' });
            });
          } else {
            setState({ status: 'unavailable', message: 'Belum dapat terhubung ke studio. Periksa koneksi Anda, lalu coba lagi.' });
          }
        }
      };
      stopAuth = onIdTokenChanged(auth, (user) => { void check(user); }, () => {
        if (!stopped) setState({ status: 'unavailable', message: 'Sesi belum dapat diperiksa. Silakan coba lagi.' });
      });
      stopForeground = AppState.addEventListener('change', (status) => {
        if (status === 'active' && auth.currentUser) void check(auth.currentUser, true);
      });

    return () => {
      stopped = true;
      generation++;
      stopAuth?.();
      stopMembership?.();
      stopProfile?.();
      stopStudio?.();
      stopForeground?.remove();
    };
  }, [attempt, configuration]);

  const login = useCallback(async (email: string, password: string) => {
    signedOutMessage.current = undefined;
    setState({ status: 'signedOut' });
    await signInWithEmailAndPassword(getFirebaseClient().auth, normalizeEmail(email), password);
  }, []);
  const logout = useCallback(async () => {
    signedOutMessage.current = undefined;
    await firebaseSignOut(getFirebaseClient().auth);
  }, []);

  return <AuthContext.Provider value={{ state, login, logout, retry }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus berada di dalam AuthProvider.');
  return context;
}

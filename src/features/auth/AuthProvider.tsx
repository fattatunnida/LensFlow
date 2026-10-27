import { onIdTokenChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { AccessDeniedError, parseSession, type StudioSession } from '@/lib/auth/session';
import { normalizeEmail } from '@/lib/auth/validation';
import { getFirebaseClient } from '@/lib/firebase/client';
import { AuthActionGate } from '@/lib/auth/action-gate';
import { feedback } from '@/lib/feedback/store';

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
  const [actions] = useState(() => new AuthActionGate());
  const invalidate = useRef<() => void>(() => {});
  const signingOut = useRef(false);
  const signedOutMessage = useRef<string | undefined>(undefined);
  const signedOutTitle = useRef('Akses studio belum tersedia');
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
    function stopDataListeners() { stopMembership?.(); stopProfile?.(); stopStudio?.(); stopMembership = undefined; stopProfile = undefined; stopStudio = undefined; }
    invalidate.current = () => { generation++; authenticatedUid = null; stopDataListeners(); };
    function authenticated(session: StudioSession) {
      feedback.setScope(`${session.uid}/${session.studioId}`);
      setState({ status: 'authenticated', session });
      actions.authenticated(session.uid);
    }

      const { auth, db } = configuration.client;
      const check = async (user: User | null, blocking = false) => {
        if (user && signingOut.current) return;
        const version = ++generation;
        stopDataListeners();
        if (!user) {
          signingOut.current = false;
          authenticatedUid = null;
          if (!stopped) {
            feedback.setScope(null);
            setState({ status: 'signedOut', message: signedOutMessage.current });
            actions.unauthenticated();
            if (signedOutMessage.current) feedback.publish({ title: signedOutTitle.current, message: 'Silakan masuk kembali atau hubungi pemilik studio.', tone: 'info', key: 'auth-access-ended' });
          }
          return;
        }
        // Credential refresh for the same identity must preserve form navigation.
        // Initial access blocks; foreground checks retain the current form.
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
          authenticated(session);

          let latestProfile: Record<string, unknown> | undefined = profile;
          let latestStudio = studio.data(), latestMember = member.data();
          const emitMetadata = () => {
            if (!alive(version)) return;
            try { authenticated(parseSession(user.uid, latestProfile, latestMember, latestStudio)); }
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
              authenticated(latest);
            } catch {
              signedOutMessage.current = 'Akses akun Anda telah dinonaktifkan. Hubungi pemilik studio.';
              signedOutTitle.current = 'Akses akun berakhir';
              actions.rejectPending(Object.assign(new Error(signedOutMessage.current), { code: 'app/auth-access-denied' }));
              feedback.setScope(null);
              signingOut.current = true;
              setState({ status: 'loading' });
              void firebaseSignOut(auth).catch(() => {
                signingOut.current = false;
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
            signedOutTitle.current = authenticatedUid === user.uid ? 'Akses akun berakhir' : 'Akses studio belum tersedia';
            actions.rejectPending(Object.assign(new Error(signedOutMessage.current), { code: 'app/auth-access-denied' }));
            feedback.setScope(null);
            signingOut.current = true;
            setState({ status: 'loading' });
            await firebaseSignOut(auth).catch(() => {
              signingOut.current = false;
              if (alive(version)) setState({ status: 'unavailable', message: 'Sesi belum berhasil dibersihkan. Coba keluar kembali.' });
            });
          } else {
            actions.rejectPending(Object.assign(new Error('Belum dapat terhubung ke studio. Periksa koneksi Anda, lalu coba lagi.'), { code: 'app/auth-unavailable' }));
            feedback.setScope(null);
            setState({ status: 'unavailable', message: 'Belum dapat terhubung ke studio. Periksa koneksi Anda, lalu coba lagi.' });
          }
        }
      };
      stopAuth = onIdTokenChanged(auth, (user) => { void check(user); }, () => {
        if (!stopped) { actions.rejectPending(new Error('Sesi belum dapat diperiksa.')); setState({ status: 'unavailable', message: 'Sesi belum dapat diperiksa. Silakan coba lagi.' }); }
      });
      stopForeground = AppState.addEventListener('change', (status) => {
        if (status === 'active' && auth.currentUser) void check(auth.currentUser);
      });

    return () => {
      stopped = true;
      generation++;
      actions.dispose();
      invalidate.current = () => {};
      stopAuth?.();
      stopMembership?.();
      stopProfile?.();
      stopStudio?.();
      stopForeground?.remove();
    };
  }, [actions, attempt, configuration]);

  const login = useCallback(async (email: string, password: string) => {
    const action = actions.begin('login');
    signedOutMessage.current = undefined;
    setState({ status: 'signedOut' });
    try {
      const credential = await signInWithEmailAndPassword(getFirebaseClient().auth, normalizeEmail(email), password);
      actions.confirmed(action.id, credential.user.uid);
      await action.promise;
      if (getFirebaseClient().auth.currentUser?.uid === credential.user.uid) feedback.publish({ title: 'Berhasil masuk', message: 'Selamat datang di LensFlow.', key: `auth-login-${action.id}`, device: true });
    } catch (error) { actions.fail(action.id, error); throw error; }
  }, [actions]);
  const logout = useCallback(async () => {
    const action = actions.begin('logout');
    signedOutMessage.current = undefined;
    // Invalidate outstanding reads before asking Firebase to clear the session.
    signingOut.current = true;
    invalidate.current();
    feedback.setScope(null);
    setState({ status: 'loading' });
    try {
      await firebaseSignOut(getFirebaseClient().auth);
      signingOut.current = false;
      if (!getFirebaseClient().auth.currentUser) {
        setState({ status: 'signedOut' });
        actions.unauthenticated();
      }
      actions.confirmed(action.id);
      await action.promise;
      feedback.publish({ title: 'Berhasil keluar', message: 'Anda sudah keluar dari akun LensFlow.', key: `auth-logout-${action.id}`, device: true });
    } catch (error) {
      signingOut.current = false;
      actions.fail(action.id, error);
      setState({ status: 'unavailable', message: 'Sesi belum berhasil dibersihkan. Coba keluar kembali.' });
      feedback.publish({ title: 'Belum berhasil keluar', message: 'Periksa koneksi lalu coba lagi.', tone: 'error' });
      throw error;
    }
  }, [actions]);

  return <AuthContext.Provider value={{ state, login, logout, retry }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus berada di dalam AuthProvider.');
  return context;
}

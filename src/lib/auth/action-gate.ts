type Kind = 'login' | 'logout';
export type AuthAction = { id: number; kind: Kind; promise: Promise<void> };
type Pending = AuthAction & { uid?: string; confirmed: boolean; resolve(): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> };
const cancelled = () => Object.assign(new Error('Permintaan sesi dibatalkan. Silakan coba lagi.'), { code: 'app/auth-cancelled' });

/** Firebase credentials and validated studio access must agree before success. */
export class AuthActionGate {
  private pending: Pending | null = null;
  private validatedUid: string | null = null;
  private signedOut = false;
  private serial = 0;
  begin(kind: Kind, timeout = 50000): AuthAction {
    if (this.pending) throw Object.assign(new Error('Tunggu proses akun yang sedang berjalan.'), { code: 'app/auth-busy' });
    let resolve!: () => void, reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    // A credential request may fail before its caller starts awaiting the gate.
    void promise.catch(() => {});
    const id = ++this.serial;
    this.validatedUid = null; this.signedOut = false;
    this.pending = { id, kind, promise, confirmed: false, resolve, reject, timer: setTimeout(() => this.fail(id, Object.assign(new Error('Pemeriksaan sesi terlalu lama. Silakan coba lagi.'), { code: 'app/auth-timeout' })), timeout) };
    return { id, kind, promise };
  }
  confirmed(id: number, uid?: string) {
    if (this.pending?.id !== id) return;
    this.pending.confirmed = true; this.pending.uid = uid; this.finish();
  }
  authenticated(uid: string) { this.validatedUid = uid; this.finish(); }
  unauthenticated() {
    this.validatedUid = null; this.signedOut = true;
    if (this.pending?.kind === 'login' && this.pending.confirmed) this.fail(this.pending.id, cancelled());
    else this.finish();
  }
  private finish() {
    const p = this.pending;
    if (!p?.confirmed || !(p.kind === 'login' ? p.uid === this.validatedUid : this.signedOut)) return;
    clearTimeout(p.timer); this.pending = null; p.resolve();
  }
  fail(id: number, error: unknown) {
    const p = this.pending;
    if (!p || p.id !== id) return;
    clearTimeout(p.timer); this.pending = null; p.reject(error);
  }
  rejectPending(error: unknown) { if (this.pending) this.fail(this.pending.id, error); }
  dispose() { this.rejectPending(cancelled()); }
}

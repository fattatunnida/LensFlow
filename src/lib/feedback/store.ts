export type NoticeInput = {
  title: string;
  message?: string;
  tone?: 'success' | 'info' | 'error';
  key?: string;
  device?: boolean;
};
export type Notice = NoticeInput & { id: number; epoch: number; expiresAt: number };

/** Small, ephemeral UI queue. Never persist session messages or business data. */
export class FeedbackStore {
  private scope: string | null = null;
  private epoch = 0;
  private serial = 0;
  private items: readonly Notice[] = [];
  private seen = new Set<string>();
  private listeners = new Set<() => void>();
  getSnapshot = () => this.items;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  setScope(scope: string | null) {
    if (scope === this.scope) return;
    this.scope = scope; this.epoch++; this.items = []; this.seen.clear(); this.emit();
  }
  getEpoch = () => this.epoch;
  isCurrent = (epoch: number) => epoch === this.epoch;
  capture() {
    const epoch = this.epoch;
    return (input: NoticeInput) => this.publish(input, epoch);
  }
  publish(input: NoticeInput, epoch = this.epoch) {
    if (epoch !== this.epoch || input.key && this.seen.has(input.key)) return null;
    if (input.key) {
      this.seen.add(input.key);
      if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value!);
    }
    const notice: Notice = { ...input, tone: input.tone ?? 'success', id: ++this.serial, epoch, expiresAt: Date.now() + (input.tone === 'error' ? 7000 : 5000) };
    this.items = [...this.items.filter(item => item.expiresAt > Date.now()).slice(-2), notice];
    this.emit(); return notice;
  }
  dismiss = (id: number) => { this.items = this.items.filter(item => item.id !== id); this.emit(); };
}
export const feedback = new FeedbackStore();

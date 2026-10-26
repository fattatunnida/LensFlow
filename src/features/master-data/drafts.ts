/** Memory only: scoped to authenticated user and studio, cleared on sign-out. */
export type Draft<T> = { id: string; version: number | null; values: T; mutation?: { fingerprint: string; id: string } };
const drafts = new Map<string, Draft<unknown>>();
export function draftKey(uid: string, studioId: string, kind: string, id?: string): string { return JSON.stringify([uid, studioId, kind, id ?? 'new']); }
export function readDraft<T>(key: string): Draft<T> | undefined { return drafts.get(key) as Draft<T> | undefined; }
export function writeDraft<T>(key: string, draft: Draft<T>): void { drafts.set(key, draft); }
export function clearDraft(key: string, mutationId?: string): void {
  if (!mutationId || drafts.get(key)?.mutation?.id === mutationId) drafts.delete(key);
}
export function clearMasterDrafts(): void { drafts.clear(); }

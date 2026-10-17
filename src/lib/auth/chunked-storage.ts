export type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type Manifest = { generation: string; count: number };

// Firebase's persisted auth record can exceed historical iOS Keychain limits.
// Publish a new manifest only after all new chunks are safely stored.
export function createChunkedStorage(store: AsyncKeyValueStore): AsyncKeyValueStore {
  const baseKey = (key: string) => 'lf_' + Array.from(key).map((c) => c.codePointAt(0)!.toString(16)).join('_');
  const chunkKey = (base: string, manifest: Manifest, index: number) => `${base}.${manifest.generation}.${index}`;
  const readManifest = async (base: string): Promise<Manifest | null> => {
    const value = await store.getItem(base);
    if (!value) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { await store.removeItem(base); return null; }
    if (!parsed || typeof parsed !== 'object' || !('generation' in parsed) || !('count' in parsed)
      || typeof parsed.generation !== 'string' || !/^[a-z0-9]+$/.test(parsed.generation)
      || !Number.isInteger(parsed.count) || Number(parsed.count) < 1 || Number(parsed.count) > 1000) {
      await store.removeItem(base);
      return null;
    }
    return parsed as Manifest;
  };
  const cleanup = async (base: string, manifest: Manifest | null) => {
    if (manifest) await Promise.all(Array.from({ length: manifest.count }, (_, i) => store.removeItem(chunkKey(base, manifest, i))));
  };
  const operations: AsyncKeyValueStore = {
    async getItem(key) {
      const base = baseKey(key);
      const manifest = await readManifest(base);
      if (!manifest) return null;
      const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, i) => store.getItem(chunkKey(base, manifest, i))));
      if (chunks.some((chunk) => chunk === null)) {
        await store.removeItem(base);
        await cleanup(base, manifest);
        return null;
      }
      return chunks.join('');
    },
    async setItem(key, value) {
      const base = baseKey(key);
      const old = await readManifest(base);
      const chars = Array.from(value);
      const chunks = Array.from({ length: Math.max(1, Math.ceil(chars.length / 400)) }, (_, i) => chars.slice(i * 400, (i + 1) * 400).join(''));
      if (chunks.length > 1000) throw new Error('Ukuran sesi melebihi batas penyimpanan.');
      const manifest = { generation: Date.now().toString(36) + Math.random().toString(36).slice(2), count: chunks.length };
      try {
        // Sequential writes also make rollback deterministic on native errors.
        for (let i = 0; i < chunks.length; i++) await store.setItem(chunkKey(base, manifest, i), chunks[i]);
        await store.setItem(base, JSON.stringify(manifest));
      } catch (error) {
        await cleanup(base, manifest).catch(() => {});
        throw error;
      }
      await cleanup(base, old).catch(() => {});
    },
    async removeItem(key) {
      const base = baseKey(key);
      const manifest = await readManifest(base);
      await store.removeItem(base);
      await cleanup(base, manifest);
    },
  };
  const pending = new Map<string, Promise<unknown>>();
  function serialize<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const task = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
    pending.set(key, task);
    void task.finally(() => { if (pending.get(key) === task) pending.delete(key); }).catch(() => {});
    return task;
  }
  return {
    getItem: (key) => serialize(key, () => operations.getItem(key)),
    setItem: (key, value) => serialize(key, () => operations.setItem(key, value)),
    removeItem: (key) => serialize(key, () => operations.removeItem(key)),
  };
}

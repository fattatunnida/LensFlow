import {
  collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query,
  runTransaction, serverTimestamp, startAfter, Timestamp, where,
  type DocumentSnapshot, type Firestore, type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { canRead, canWrite, LEAD_SOURCES, MasterDataError, type ClientRecord, type LeadSource, type MasterActor, type MasterKind, type MasterPayloads, type MasterRecords, type PackageFilter, type PhotoPackage } from './models';
import { clientSearch, validateClient, validatePackage } from './validation';

export const PAGE_SIZE = 25;
export type MasterPage<T> = { items: T[]; cursor: QueryDocumentSnapshot | null; hasMore: boolean };
export function newMasterId(db: Firestore): string { return doc(collection(db, '_ids')).id; }

function identifier(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new MasterDataError('missing');
  return id;
}
export function serverRead<T>(request: Promise<T>, milliseconds = 12_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new MasterDataError('network')), milliseconds);
    request.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
function stringField(data: Record<string, unknown>, field: string): string {
  if (typeof data[field] !== 'string') throw new MasterDataError('schema');
  return data[field];
}
function numberField(data: Record<string, unknown>, field: string): number {
  if (typeof data[field] !== 'number' || !Number.isFinite(data[field])) throw new MasterDataError('schema');
  return data[field];
}
function decode<K extends MasterKind>(kind: K, snapshot: DocumentSnapshot): MasterRecords[K] {
  const data = snapshot.data() as Record<string, unknown> | undefined;
  if (!data || !(data.createdAt instanceof Timestamp) || !(data.updatedAt instanceof Timestamp)
    || !Number.isInteger(data.version) || Number(data.version) < 1) throw new MasterDataError('schema');
  const meta = { id: snapshot.id, createdAt: data.createdAt.toMillis(), updatedAt: data.updatedAt.toMillis(), version: Number(data.version), createdBy: stringField(data, 'createdBy'), updatedBy: stringField(data, 'updatedBy'), mutationId: stringField(data, 'mutationId') };
  if (kind === 'clients') {
    const source = stringField(data, 'leadSource');
    if (!(LEAD_SOURCES as readonly string[]).includes(source)) throw new MasterDataError('schema');
    const checked = validateClient({ name: stringField(data, 'name'), phone: stringField(data, 'phone'), email: stringField(data, 'email'), address: stringField(data, 'address'), notes: stringField(data, 'notes'), leadSource: source as LeadSource });
    if (Object.keys(checked.errors).length || data.nameKey !== checked.value.nameKey || data.phone !== checked.value.phone) throw new MasterDataError('schema');
    return { ...checked.value, ...meta } as ClientRecord as MasterRecords[K];
  }
  if (typeof data.isActive !== 'boolean') throw new MasterDataError('schema');
  const checked = validatePackage({ name: stringField(data, 'name'), price: String(numberField(data, 'price')), durationMinutes: String(numberField(data, 'durationMinutes')), editedPhotosCount: String(numberField(data, 'editedPhotosCount')), defaultLocation: stringField(data, 'defaultLocation'), description: stringField(data, 'description'), isActive: data.isActive });
  if (Object.keys(checked.errors).length || data.nameKey !== checked.value.nameKey) throw new MasterDataError('schema');
  return { ...checked.value, ...meta } as PhotoPackage as MasterRecords[K];
}

export async function readMaster<K extends MasterKind>(db: Firestore, actor: MasterActor, kind: K, id: string): Promise<MasterRecords[K] | null> {
  if (!canRead(actor, kind)) throw new MasterDataError('permission');
  const snapshot = await serverRead(getDocFromServer(doc(db, 'studios', identifier(actor.studioId), kind, identifier(id))));
  if (!snapshot.exists()) return null;
  return decode(kind, snapshot);
}

export async function readMasterPage<K extends MasterKind>(db: Firestore, actor: MasterActor, kind: K, search = '', filter: PackageFilter = 'all', cursor?: QueryDocumentSnapshot | null): Promise<MasterPage<MasterRecords[K]>> {
  if (!canRead(actor, kind)) throw new MasterDataError('permission');
  if (search.length > 100) throw new MasterDataError('validation');
  const constraints: QueryConstraint[] = [];
  if (kind === 'packages') {
    if (actor.role !== 'owner' && filter !== 'active') throw new MasterDataError('permission');
    if (filter !== 'all') constraints.push(where('isActive', '==', filter === 'active'));
  }
  const { field, prefix } = kind === 'clients' ? clientSearch(search) : { field: 'nameKey', prefix: search.trim().toLowerCase() };
  if (prefix) constraints.push(where(field, '>=', prefix), where(field, '<=', `${prefix}\uf8ff`));
  constraints.push(orderBy(field));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(PAGE_SIZE + 1));
  const result = await serverRead(getDocsFromServer(query(collection(db, 'studios', identifier(actor.studioId), kind), ...constraints)));
  const visible = result.docs.slice(0, PAGE_SIZE);
  return { items: visible.map((snapshot) => decode(kind, snapshot)), cursor: visible.at(-1) ?? null, hasMore: result.size > PAGE_SIZE };
}

export async function duplicateClients(db: Firestore, actor: MasterActor, phone: string, exceptId?: string): Promise<string[]> {
  if (!canRead(actor, 'clients')) throw new MasterDataError('permission');
  const result = await serverRead(getDocsFromServer(query(collection(db, 'studios', identifier(actor.studioId), 'clients'), where('phone', '==', phone), limit(3))));
  return result.docs.filter((snapshot) => snapshot.id !== exceptId).map((snapshot) => stringField(snapshot.data() as Record<string, unknown>, 'name'));
}

/** Transactions are online-only. Resolve only after commit; retries reuse ID + mutation ID. */
export async function saveMaster<K extends MasterKind>(db: Firestore, actor: MasterActor, kind: K, id: string, expectedVersion: number | null, value: MasterPayloads[K], mutationId: string): Promise<{ id: string; version: number }> {
  if (!canWrite(actor, kind)) throw new MasterDataError('permission');
  const ref = doc(db, 'studios', identifier(actor.studioId), kind, identifier(id));
  // Bound the read-only preflight before attempting a write, rather than timing
  // out a commit that might still complete later and pretending it was rejected.
  const member = await serverRead(getDocFromServer(doc(db, 'studios', actor.studioId, 'members', identifier(actor.uid))));
  const membership = member.data();
  if (membership?.status !== 'active' || (membership.role !== 'owner' && !(kind === 'clients' && membership.role === 'staff' && membership.permissions?.calendarCrm === true))) throw new MasterDataError('permission');
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    if (current?.mutationId === mutationId) {
      if (current.updatedBy === actor.uid && Object.entries(value).every(([field, item]) => current[field] === item)) return { id, version: Number(current.version) };
      throw new MasterDataError('conflict');
    }
    if (expectedVersion === null) {
      if (snapshot.exists()) throw new MasterDataError('conflict');
      transaction.set(ref, { ...value, version: 1, mutationId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: actor.uid, updatedBy: actor.uid });
      return { id, version: 1 };
    }
    if (!snapshot.exists()) throw new MasterDataError('missing');
    if (current?.version !== expectedVersion) throw new MasterDataError('conflict');
    transaction.update(ref, { ...value, version: expectedVersion + 1, mutationId, updatedAt: serverTimestamp(), updatedBy: actor.uid });
    return { id, version: expectedVersion + 1 };
  }, { maxAttempts: 3 });
}

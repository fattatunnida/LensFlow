import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorMessage, normalizeEmail, validateLogin } from '../src/lib/auth/validation';
import { AccessDeniedError, parseSession } from '../src/lib/auth/session';
import { createChunkedStorage, type AsyncKeyValueStore } from '../src/lib/auth/chunked-storage';

test('email is normalized but password is not trimmed', () => {
  assert.equal(normalizeEmail('  OWNER@Studio.COM '), 'owner@studio.com');
  assert.deepEqual(validateLogin('owner@studio.com', ' '), {});
  assert.ok(validateLogin('not-an-email', '').email);
  assert.ok(validateLogin('owner@studio.com', '').password);
});
test('auth errors do not enumerate user accounts or expose provider errors', () => {
  const unknown = authErrorMessage({ code: 'auth/user-not-found' });
  assert.equal(unknown, authErrorMessage({ code: 'auth/wrong-password' }));
  assert.equal(unknown, authErrorMessage({ code: 'auth/invalid-credential' }));
  assert.ok(!authErrorMessage(new Error('secret value')).includes('secret'));
});
const profile = { displayName: 'Andi Pratama', email: 'owner@studio.test', studioId: 'studio-a' };
const member = { role: 'owner', status: 'active', permissions: { booking: true, calendarCrm: true, payments: true, reports: true } };
test('session requires a provisioned active member and well-formed documents', () => {
  assert.equal(parseSession('owner', profile, member, { name: 'Studio A' }).studioName, 'Studio A');
  for (const invalid of [undefined, { ...member, status: 'inactive' }, { ...member, role: 'admin' }, { ...member, permissions: { booking: 'true' } }]) {
    assert.throws(() => parseSession('owner', profile, invalid, { name: 'Studio A' }), AccessDeniedError);
  }
  assert.throws(() => parseSession('owner', { ...profile, studioId: '../studio-b' }, member, { name: 'Studio' }), AccessDeniedError);
});
test('staff permissions are preserved rather than elevated to owner', () => {
  const session = parseSession('staff', profile, { ...member, role: 'staff', permissions: { booking: true, calendarCrm: true, payments: false, reports: false } }, { name: 'Studio' });
  assert.equal(session.role, 'staff'); assert.equal(session.permissions.payments, false);
});
function memoryStore() {
  const data = new Map<string, string>();
  const raw: AsyncKeyValueStore = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { assert.ok(Buffer.byteLength(value) <= 2048); data.set(key, value); },
    removeItem: async (key) => { data.delete(key); },
  };
  return { data, raw };
}
test('large auth record survives secure storage chunking including Unicode', async () => {
  const { data, raw } = memoryStore(); const store = createChunkedStorage(raw);
  const value = JSON.stringify({ token: 'a'.repeat(5000), name: '📷摄影'.repeat(300) });
  await store.setItem('firebase:authUser:key:[DEFAULT]', value);
  assert.equal(await store.getItem('firebase:authUser:key:[DEFAULT]'), value);
  assert.ok(data.size > 2);
  await store.removeItem('firebase:authUser:key:[DEFAULT]');
  assert.equal(await store.getItem('firebase:authUser:key:[DEFAULT]'), null);
  assert.equal(data.size, 0);
});
test('failed secure storage replacement retains the last committed session', async () => {
  const { data, raw } = memoryStore(); let failed = false;
  const store = createChunkedStorage({ ...raw, setItem: async (key, value) => {
    if (failed && key.endsWith('.1')) throw new Error('Keychain full');
    await raw.setItem(key, value);
  } });
  await store.setItem('auth', 'old'); failed = true;
  await assert.rejects(store.setItem('auth', 'new'.repeat(1000)), /Keychain full/);
  assert.equal(await store.getItem('auth'), 'old');
  assert.equal(data.size, 2);
});
test('concurrent token updates and logout are serialized', async () => {
  const { raw } = memoryStore(); const store = createChunkedStorage(raw);
  await Promise.all([store.setItem('auth', 'first'), store.setItem('auth', 'second'), store.removeItem('auth')]);
  assert.equal(await store.getItem('auth'), null);
});
test('corrupt manifest clears local session rather than preventing sign-in forever', async () => {
  const { data, raw } = memoryStore(); const store = createChunkedStorage(raw);
  await store.setItem('auth', 'valid-session');
  const manifestKey = [...data.keys()].find((key) => !key.includes('.'))!;
  data.set(manifestKey, '{broken-json');
  assert.equal(await store.getItem('auth'), null);
  await store.setItem('auth', 'new-session');
  assert.equal(await store.getItem('auth'), 'new-session');
});
test('missing secure storage chunk invalidates and removes the partial session', async () => {
  const { data, raw } = memoryStore(); const store = createChunkedStorage(raw);
  await store.setItem('auth', 'token'.repeat(500));
  data.delete([...data.keys()].find((key) => key.endsWith('.1'))!);
  assert.equal(await store.getItem('auth'), null);
  assert.equal(data.size, 0);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canRead, canWrite, type ClientInput, type MasterActor, type PackageInput } from '../src/features/master-data/models';
import { clientSearch, contactUrls, validateClient, validatePackage } from '../src/features/master-data/validation';
import { clearDraft, clearMasterDrafts, draftKey, readDraft, writeDraft } from '../src/features/master-data/drafts';

const client: ClientInput = { name: ' Rina   Amelia ', phone: '0812-3456-7890', email: ' RINA@STUDIO.COM ', address: ' Studio A ', notes: '', leadSource: 'instagram' };
const photoPackage: PackageInput = { name: 'Portrait', price: '2.500.000', durationMinutes: '180', editedPhotosCount: '25', defaultLocation: 'Studio A', description: '', isActive: true };

test('customer validation normalizes contacts without altering original input', () => {
  const { value, errors } = validateClient(client);
  assert.deepEqual(errors, {});
  assert.equal(value.name, 'Rina Amelia'); assert.equal(value.nameKey, 'rina amelia');
  assert.equal(value.phone, '+6281234567890'); assert.equal(value.email, 'rina@studio.com');
  assert.equal(client.phone, '0812-3456-7890');
  assert.equal(validateClient({ ...client, phone: '+44 20 1234 5678' }).value.phone, '+442012345678');
});

test('customer validation rejects malformed contact values and oversized notes', () => {
  for (const phone of ['abc081234567890', '+62+81234567890', '+0123456789', '0812', '0812345678901234567']) assert.ok(validateClient({ ...client, phone }).errors.phone, phone);
  assert.ok(validateClient({ ...client, name: ' ', email: 'broken', notes: 'a'.repeat(2001) }).errors.name);
  assert.ok(validateClient({ ...client, email: 'broken' }).errors.email);
  assert.ok(validateClient({ ...client, notes: 'a'.repeat(2001) }).errors.notes);
});

test('package prices remain integer Rupiah and bounded catalog attributes', () => {
  const valid = validatePackage(photoPackage);
  assert.deepEqual(valid.errors, {}); assert.equal(valid.value.price, 2500000);
  for (const price of ['0', '-1', '1e6', '2,5', '2.50', '1000000001', 'Infinity']) assert.ok(validatePackage({ ...photoPackage, price }).errors.price, price);
  assert.ok(validatePackage({ ...photoPackage, durationMinutes: '14' }).errors.durationMinutes);
  assert.ok(validatePackage({ ...photoPackage, durationMinutes: '1441' }).errors.durationMinutes);
  assert.ok(validatePackage({ ...photoPackage, editedPhotosCount: '1.5' }).errors.editedPhotosCount);
  assert.ok(validatePackage({ ...photoPackage, defaultLocation: ' ' }).errors.defaultLocation);
  assert.deepEqual(validatePackage({ ...photoPackage, price: '1', editedPhotosCount: '0', isActive: false }).errors, {});
});

test('search prefixes and contact URLs cannot inject executable schemes', () => {
  assert.deepEqual(clientSearch(' RINA '), { field: 'nameKey', prefix: 'rina' });
  for (const value of ['0812', '812', '+62812', '62812', '0062812']) assert.deepEqual(clientSearch(value), { field: 'phone', prefix: '+62812' });
  assert.deepEqual(clientSearch('0'), { field: 'phone', prefix: '+62' });
  assert.deepEqual(contactUrls('+6281234567890'), { phone: 'tel:+6281234567890', whatsapp: 'https://wa.me/6281234567890' });
  assert.equal(contactUrls('javascript:alert(1)'), null);
  assert.equal(contactUrls('+6281234567890;123'), null);
});

test('catalog writes are owner-only while CRM uses its own permission', () => {
  const actor: MasterActor = { uid: 'staff', studioId: 'studio-a', role: 'staff', crm: true, booking: false };
  assert.ok(canRead(actor, 'clients')); assert.ok(canWrite(actor, 'clients'));
  assert.equal(canRead(actor, 'packages'), false); assert.equal(canWrite(actor, 'packages'), false);
  assert.ok(canRead({ ...actor, booking: true }, 'packages'));
  assert.ok(canWrite({ ...actor, role: 'owner' }, 'packages'));
});

test('drafts are scoped and an older request cannot discard a newer edit', () => {
  clearMasterDrafts();
  const key = draftKey('u1', 's1', 'clients');
  writeDraft(key, { id: 'client1', version: null, values: client, mutation: { fingerprint: 'first', id: 'mutation-first' } });
  assert.equal(readDraft(draftKey('u2', 's1', 'clients')), undefined);
  assert.equal(readDraft(draftKey('u1', 's2', 'clients')), undefined);
  writeDraft(key, { id: 'client1', version: null, values: { ...client, name: 'Revised' } });
  clearDraft(key, 'mutation-first');
  assert.equal(readDraft<ClientInput>(key)?.values.name, 'Revised');
  clearMasterDrafts(); assert.equal(readDraft(key), undefined);
});

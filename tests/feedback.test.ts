import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FeedbackStore } from '../src/lib/feedback/store';
import { AuthActionGate } from '../src/lib/auth/action-gate';

test('login resolves only after both credentials and studio access validate the same UID', async () => {
  const gate = new AuthActionGate(), action = gate.begin('login');
  let ready = false; void action.promise.then(() => { ready = true; });
  gate.confirmed(action.id, 'owner'); gate.authenticated('another-user');
  await Promise.resolve(); assert.equal(ready, false);
  gate.authenticated('owner'); await action.promise; assert.equal(ready, true);
  gate.authenticated('owner'); gate.authenticated('owner');
});
test('validated access arriving before the credential promise is handled once', async () => {
  const gate = new AuthActionGate(), action = gate.begin('login');
  gate.authenticated('owner'); gate.confirmed(action.id, 'owner'); await action.promise;
  const next = gate.begin('logout'); gate.unauthenticated(); gate.confirmed(next.id); await next.promise;
});
test('credential or membership failures never become a successful login', async () => {
  const gate = new AuthActionGate(), action = gate.begin('login');
  gate.confirmed(action.id, 'staff'); gate.rejectPending(new Error('No active membership'));
  await assert.rejects(action.promise, /No active membership/);
  gate.authenticated('staff');
  const logout = gate.begin('logout'); gate.confirmed(logout.id); gate.unauthenticated(); await logout.promise;
});
test('logout requires sign-out completion, ignores stale actions and releases locks on error', async () => {
  const gate = new AuthActionGate(), first = gate.begin('logout');
  assert.throws(() => gate.begin('login'), /Tunggu proses/);
  gate.unauthenticated(); gate.fail(first.id, new Error('Storage unavailable'));
  await assert.rejects(first.promise, /Storage unavailable/);
  const second = gate.begin('login'); gate.confirmed(first.id, 'old'); gate.authenticated('old');
  gate.confirmed(second.id, 'new'); gate.authenticated('new'); await second.promise;
});
test('session disposal and timeouts reject pending work without leaving an action lock', async () => {
  const gate = new AuthActionGate(), disposed = gate.begin('login'); gate.dispose();
  await assert.rejects(disposed.promise, { code: 'app/auth-cancelled' });
  const timed = gate.begin('login', 5); await assert.rejects(timed.promise, { code: 'app/auth-timeout' });
  const retry = gate.begin('login'); gate.confirmed(retry.id, 'owner'); gate.authenticated('owner'); await retry.promise;
});
test('late confirmations from another session are dropped after logout or account switch', async () => {
  const store = new FeedbackStore(); store.setScope('owner/studio-a');
  const late = store.capture();
  await Promise.resolve(); store.setScope(null); late({ title: 'Private old result' });
  assert.deepEqual(store.getSnapshot(), []);
  store.publish({ title: 'Berhasil keluar' }); store.setScope('staff/studio-b');
  assert.deepEqual(store.getSnapshot(), []); late({ title: 'Old save result' });
  assert.deepEqual(store.getSnapshot(), []);
});
test('mutation retries are deduplicated and the ephemeral feedback queue stays bounded', () => {
  const store = new FeedbackStore(); store.setScope('owner/studio');
  store.publish({ title: 'Payment saved', key: 'payment-1' });
  store.publish({ title: 'Payment saved', key: 'payment-1' });
  assert.equal(store.getSnapshot().length, 1);
  for (let n = 0; n < 6; n++) store.publish({ title: `Saved ${n}`, key: `save-${n}` });
  assert.equal(store.getSnapshot().length, 3);
  const last = store.getSnapshot().at(-1)!; store.dismiss(last.id);
  assert.ok(!store.getSnapshot().some(item => item.id === last.id));
});

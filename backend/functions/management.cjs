const { FieldPath, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { createHash } = require('node:crypto');
const { fail, id, text, minute } = require('./domain.cjs');
const permissions = ['booking', 'calendarCrm', 'payments', 'reports'];
const hash = value => createHash('sha256').update(value).digest('hex');
function input(raw, keys) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !keys.includes(k))) fail('invalid-argument', 'Permintaan tidak valid.');
  id(raw.studioId); return raw;
}
async function context(db, uid, studioId, tx, owner = false) {
  if (!uid) fail('unauthenticated', 'Silakan masuk kembali.'); id(uid);
  const root = db.doc(`studios/${studioId}`), get = ref => tx ? tx.get(ref) : ref.get();
  const [p, m, s] = await Promise.all([get(db.doc(`users/${uid}`)), get(root.collection('members').doc(uid)), get(root)]);
  if (p.get('studioId') !== studioId || m.get('status') !== 'active' || !['owner', 'staff'].includes(m.get('role')) || !s.exists || owner && m.get('role') !== 'owner') fail('permission-denied', 'Akses tidak tersedia.');
  return { root, profile: p.data(), member: m.data(), studio: s.data() };
}
function version(value) { if (!Number.isInteger(value) || value < 0) fail('invalid-argument', 'Versi tidak valid.'); }
function perms(value) { if (!value || Object.keys(value).length !== 4 || !permissions.every(k => typeof value[k] === 'boolean')) fail('invalid-argument', 'Empat izin wajib berupa boolean.'); return value; }
function email(value) { const e = text(value, 3, 254, 'Email').toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('invalid-argument', 'Email tidak valid.'); return e; }
function phone(value) { const p = text(value, 0, 24, 'Nomor telepon'); if (p && !/^\+?[0-9 ()-]{8,24}$/.test(p)) fail('invalid-argument', 'Nomor telepon tidak valid.'); return p; }
async function studio(db, uid, raw) {
  const d = input(raw, ['studioId', 'value', 'expectedVersion']);
  if (d.value === undefined) { const c = await context(db, uid, d.studioId, null, true), s = c.studio; return { name: s.name, address: s.address ?? '', phone: s.phone ?? '', openingTime: s.openingTime ?? '08:00', closingTime: s.closingTime ?? '21:00', defaultDpPercent: s.defaultDpPercent ?? 30, timezone: s.timezone ?? 'Asia/Jakarta', version: s.settingsVersion ?? 0 }; }
  version(d.expectedVersion); const v = d.value;
  if (!v || Object.keys(v).some(k => !['name','address','phone','openingTime','closingTime','defaultDpPercent'].includes(k))) fail('invalid-argument', 'Pengaturan tidak valid.');
  const value = { name: text(v.name, 2, 100, 'Nama studio'), address: text(v.address, 0, 500, 'Alamat'), phone: phone(v.phone), openingTime: v.openingTime, closingTime: v.closingTime, defaultDpPercent: v.defaultDpPercent };
  const open = minute(v.openingTime), close = minute(v.closingTime);
  if (open % 15 || close % 15 || close - open < 15 || !Number.isInteger(v.defaultDpPercent) || v.defaultDpPercent < 0 || v.defaultDpPercent > 100) fail('invalid-argument', 'Jam buka harus berurutan, kelipatan 15 menit, dan DP 0–100%.');
  return db.runTransaction(async tx => { const c = await context(db, uid, d.studioId, tx, true); if ((c.studio.settingsVersion ?? 0) !== d.expectedVersion) fail('aborted', 'Pengaturan berubah. Muat ulang dahulu.'); const next = d.expectedVersion + 1; tx.update(c.root, { ...value, settingsVersion: next, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }); return { ...value, timezone: c.studio.timezone ?? 'Asia/Jakarta', version: next }; });
}
async function profile(db, uid, raw) {
  const d = input(raw, ['studioId','value','expectedVersion']);
  if (d.value === undefined) { const c = await context(db, uid, d.studioId); return { displayName: c.profile.displayName, phone: c.profile.phone ?? '', jobTitle: c.profile.jobTitle ?? '', email: c.profile.email, version: c.profile.version ?? 0 }; }
  version(d.expectedVersion); const v = d.value;
  if (!v || Object.keys(v).some(k => !['displayName','phone','jobTitle'].includes(k))) fail('invalid-argument', 'Profil tidak valid.');
  const value = { displayName: text(v.displayName, 2, 100, 'Nama'), phone: phone(v.phone), jobTitle: text(v.jobTitle, 0, 80, 'Jabatan') };
  return db.runTransaction(async tx => { const c = await context(db, uid, d.studioId, tx); if ((c.profile.version ?? 0) !== d.expectedVersion) fail('aborted', 'Profil berubah. Muat ulang dahulu.'); const next = d.expectedVersion + 1; tx.update(db.doc(`users/${uid}`), { ...value, version: next, updatedAt: FieldValue.serverTimestamp() }); return { ...value, email: c.profile.email, version: next }; });
}
async function staff(db, uid, raw) {
  const d = input(raw, ['studioId','after']); const c = await context(db, uid, d.studioId, null, true);
  let query = c.root.collection('members').orderBy(FieldPath.documentId()); if (d.after) query = query.startAfter(id(d.after));
  const page = await query.limit(26).get();
  const items = await Promise.all(page.docs.slice(0,25).map(async m => { const p = (await db.doc(`users/${m.id}`).get()).data(); return { uid: m.id, displayName: p?.studioId === d.studioId ? p.displayName : 'Akun studio', email: p?.studioId === d.studioId ? p.email : '', role: m.get('role'), status: m.get('status'), pendingInvitation: !!m.get('invitedBy')&&!m.get('acceptedAt'), permissions: Object.fromEntries(permissions.map(k=>[k,m.get('permissions')?.[k]===true])), version: m.get('version') ?? 0 }; }));
  return { items, next: page.size > 25 ? items.at(-1).uid : null };
}
async function staffCommand(db, uid, raw) {
  const d = input(raw, ['studioId','action','uid','expectedVersion','permissions','status','displayName','email','mutationId']);
  const c = await context(db, uid, d.studioId, null, true);
  if (d.action === 'update') {
    id(d.uid); version(d.expectedVersion); perms(d.permissions); if (!['active','inactive','invited'].includes(d.status)) fail('invalid-argument', 'Status tidak valid.');
    return db.runTransaction(async tx => {
      await context(db, uid, d.studioId, tx, true); const ref = c.root.collection('members').doc(d.uid), doc = await tx.get(ref), member = doc.data();
      if (!member || member.role !== 'staff' || d.uid === uid) fail('permission-denied', 'Owner tidak dapat diubah melalui pengelolaan staf.');
      if ((member.version ?? 0) !== d.expectedVersion) fail('aborted', 'Data staf berubah. Muat ulang dahulu.');
      if ((member.status === 'invited' || member.invitedBy && !member.acceptedAt) && d.status === 'active' || member.status !== 'invited' && d.status === 'invited') fail('failed-precondition', 'Staf harus menerima undangan sebelum aktif.');
      const next = d.expectedVersion+1; tx.update(ref, { permissions: d.permissions, status: d.status, version: next, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
      tx.create(c.root.collection('staffEvents').doc(), { target: d.uid, actor: uid, action: 'update', permissions: d.permissions, status: d.status, version: next, createdAt: FieldValue.serverTimestamp() }); return { uid: d.uid, version: next };
    });
  }
  if (d.action === 'inviteLink') {
    id(d.uid); const address=await db.runTransaction(async tx=>{
      await context(db,uid,d.studioId,tx,true);const ref=c.root.collection('members').doc(d.uid),[member,p]=await Promise.all([tx.get(ref),tx.get(db.doc(`users/${d.uid}`))]);
      if(member.get('role')!=='staff'||!['invited','inactive'].includes(member.get('status'))||member.get('acceptedAt')||!member.get('invitedBy')||p.get('studioId')!==d.studioId)fail('failed-precondition','Undangan tidak tersedia.');
      if(member.get('status')==='inactive'){tx.update(ref,{status:'invited',version:(member.get('version')??0)+1,updatedBy:uid,updatedAt:FieldValue.serverTimestamp()});tx.create(c.root.collection('staffEvents').doc(),{action:'reinvite',target:d.uid,actor:uid,createdAt:FieldValue.serverTimestamp()});}return p.get('email');
    });
    return { uid: d.uid, link: await getAuth().generatePasswordResetLink(address) };
  }
  if (d.action !== 'invite') fail('invalid-argument', 'Aksi tidak valid.');
  const address = email(d.email), name = text(d.displayName, 2, 100, 'Nama staf'); perms(d.permissions); id(d.mutationId); if (d.mutationId.length < 12) fail('invalid-argument', 'Identitas percobaan tidak valid.');
  const target = `staff_${hash(`${d.studioId}:${address}`).slice(0,48)}`, fingerprint = hash(JSON.stringify([address,name,permissions.map(k=>d.permissions[k])]));
  const prior=await c.root.collection('staffMutations').doc(`${uid}_${d.mutationId}`).get();if(prior.exists&&prior.get('fingerprint')!==fingerprint)fail('already-exists','Identitas percobaan sudah digunakan.');
  // Auth creation is repeat-safe. The Firestore receipt commits membership/profile
  // together; a failure between the two services can be retried with the same ID.
  try { await getAuth().createUser({ uid: target, email: address }); } catch (error) {
    if (!['auth/uid-already-exists','auth/email-already-exists'].includes(error.code)) throw error;
    const existing = await getAuth().getUserByEmail(address); if (existing.uid !== target) fail('failed-precondition', 'Alamat belum dapat ditambahkan. Gunakan akun staf baru.');
  }
  await db.runTransaction(async tx => {
    await context(db, uid, d.studioId, tx, true); const memberRef = c.root.collection('members').doc(target), userRef = db.doc(`users/${target}`), receiptRef = c.root.collection('staffMutations').doc(`${uid}_${d.mutationId}`);
    const [member, user, receipt] = await Promise.all([tx.get(memberRef), tx.get(userRef), tx.get(receiptRef)]);
    if (receipt.exists) { if (receipt.get('fingerprint') !== fingerprint) fail('already-exists', 'Identitas percobaan sudah digunakan.'); if (member.get('status') !== 'invited') fail('failed-precondition', 'Undangan sudah diterima atau dinonaktifkan.'); return; }
    if (member.exists || user.exists) fail('already-exists', 'Staf sudah terdaftar. Muat ulang daftar staf.');
    tx.create(userRef, { studioId: d.studioId, email: address, displayName: name, phone: '', jobTitle: '', version: 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(memberRef, { role: 'staff', status: 'invited', permissions: d.permissions, version: 1, invitedBy: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(receiptRef, { fingerprint, uid: target, createdAt: FieldValue.serverTimestamp() });
    tx.create(c.root.collection('staffEvents').doc(), { action: 'invite', target, actor: uid, createdAt: FieldValue.serverTimestamp() });
  });
  return { uid: target, link: await getAuth().generatePasswordResetLink(address) };
}
async function accept(db, request) {
  const d = input(request.data, ['studioId']), uid = request.auth?.uid;
  if (!uid || request.auth.token.firebase?.sign_in_provider !== 'password') fail('unauthenticated', 'Masuk dengan kata sandi akun undangan terlebih dahulu.');
  const user = await getAuth().getUser(uid);
  if (user.disabled || user.email?.toLowerCase() !== request.auth.token.email?.toLowerCase()) fail('permission-denied', 'Akun undangan tidak valid.');
  return db.runTransaction(async tx => {
    const memberRef = db.doc(`studios/${d.studioId}/members/${id(uid)}`), profileRef = db.doc(`users/${uid}`), [m,p,s] = await Promise.all([tx.get(memberRef),tx.get(profileRef),tx.get(db.doc(`studios/${d.studioId}`))]);
    if (!s.exists || p.get('studioId') !== d.studioId || p.get('email') !== user.email?.toLowerCase() || m.get('role') !== 'staff') fail('permission-denied', 'Undangan tidak tersedia.');
    if (m.get('status') === 'active') return { accepted: true };
    if (m.get('status') !== 'invited' || !m.get('invitedBy')) fail('permission-denied', 'Undangan tidak tersedia.');
    tx.update(memberRef, { status: 'active', version: (m.get('version') ?? 0)+1, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(db.collection(`studios/${d.studioId}/staffEvents`).doc(), { action: 'accept', target: uid, actor: uid, createdAt: FieldValue.serverTimestamp() }); return { accepted: true };
  });
}
module.exports = { context, input, studio, profile, staff, staffCommand, accept };

const { FieldValue, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');
const { fail, id, text, interval, overlaps, normalize, searchTokens, validateCommand } = require('./domain.cjs');

async function authorization(db, uid, studioId, transaction, write = true) {
  if (!uid) fail('unauthenticated','Silakan masuk kembali.');
  id(uid); id(studioId);
  const read = (ref) => transaction ? transaction.get(ref) : ref.get();
  const [member,profile,studio] = await Promise.all([read(db.doc(`studios/${studioId}/members/${uid}`)),read(db.doc(`users/${uid}`)),read(db.doc(`studios/${studioId}`))]);
  const m = member.data();
  if (!studio.exists || profile.data()?.studioId !== studioId || m?.status !== 'active' || !['owner','staff'].includes(m.role) || (m.role !== 'owner' && m.permissions?.booking !== true && (write || m.permissions?.calendarCrm !== true))) fail('permission-denied','Anda tidak memiliki izin operasional booking.');
  return studio.data();
}
function publicSession(booking, bookingId) {
  const { code, clientId, clientName, packageName, date, startTime, endTime, startAt, endAt, location, sessionStatus, paymentStatus, version, updatedAt } = booking;
  return { bookingId, code, clientId, clientName, packageName, date, startTime, endTime, startAt, endAt, location, sessionStatus, paymentStatus, version, updatedAt,
    stateKey: sessionStatus === 'done' ? 'done' : sessionStatus === 'cancelled' ? 'cancelled' : paymentStatus,
    searchTokens: searchTokens(clientName,packageName,code,date) };
}

async function command(db, uid, raw) {
  const data = validateCommand(raw);
  const { studioId, bookingId, mutationId, action } = data;
  const root = db.doc(`studios/${studioId}`), bookingRef = root.collection('bookings').doc(bookingId);
  const commandRef = root.collection('bookingMutations').doc(`${uid}_${mutationId}`);
  const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return db.runTransaction(async (tx) => {
    const studio = await authorization(db,uid,studioId,tx);
    const [prior,bookingSnap] = await Promise.all([tx.get(commandRef),tx.get(bookingRef)]);
    if (prior.exists) {
      if (prior.data().fingerprint !== fingerprint) fail('already-exists','Identitas percobaan sudah dipakai untuk isian lain.','mutation-conflict');
      return prior.data().result;
    }
    const now = Date.now();
    let booking = bookingSnap.data(), counterRef, counter, target;
    if (action === 'create') {
      if (bookingSnap.exists) fail('already-exists','Booking sudah tersedia. Muat detail sebelum membuat ulang.','version-conflict');
      const [clientSnap,packageSnap,countSnap] = await Promise.all([tx.get(root.collection('clients').doc(data.clientId)),tx.get(root.collection('packages').doc(data.packageId)),tx.get(root.collection('bookingCounters').doc('main'))]);
      const customer = clientSnap.data(), pkg = packageSnap.data();
      if (!customer || !pkg || pkg.isActive !== true) fail('failed-precondition','Pelanggan atau paket aktif tidak tersedia. Pilih ulang.','selection-stale');
      if (customer.version !== data.clientVersion || pkg.version !== data.packageVersion) fail('failed-precondition','Data pelanggan/paket berubah. Pilih ulang untuk melihat data terbaru.','selection-stale');
      if (!Number.isSafeInteger(pkg.price) || pkg.price <= 0 || pkg.price > 1000000000 || !Number.isInteger(pkg.durationMinutes) || pkg.durationMinutes<15 || pkg.durationMinutes>1440 || !Number.isInteger(pkg.editedPhotosCount) || pkg.editedPhotosCount<0 || pkg.editedPhotosCount>1000 || typeof pkg.name !== 'string' || pkg.name.trim().length<2 || pkg.name.length>100 || typeof pkg.defaultLocation !== 'string' || !pkg.defaultLocation.trim() || typeof customer.name !== 'string' || customer.name.trim().length<2 || customer.name.length>100 || typeof customer.phone !== 'string' || !/^[+][1-9][0-9]{7,14}$/.test(customer.phone)) fail('failed-precondition','Data pelanggan/paket belum valid. Hubungi owner.');
      target = interval(data.date,data.startTime,data.endTime,studio);
      counterRef = countSnap.ref; counter = (countSnap.data()?.value ?? 0) + 1;
      if (!Number.isSafeInteger(counter)) fail('resource-exhausted','Nomor booking telah mencapai batas.');
      const percent = studio.defaultDpPercent ?? 30;
      if (!Number.isInteger(percent) || percent<0 || percent>100) fail('failed-precondition','Persentase DP studio belum valid.');
      if (percent !== data.dpPercent) fail('failed-precondition','Target DP studio berubah. Pilih ulang paket.','selection-stale');
      booking = { code: `BK-${String(counter).padStart(6,'0')}`, clientId: data.clientId, packageId: data.packageId, clientName: customer.name, clientPhone: customer.phone, clientEmail: customer.email ?? '', packageName: pkg.name,
        packageSnapshot: { name: pkg.name, price: pkg.price, durationMinutes: pkg.durationMinutes, editedPhotosCount: pkg.editedPhotosCount, defaultLocation: pkg.defaultLocation },
        total: pkg.price, paidAmount: 0, dpPercent: percent, dpTarget: Math.floor((pkg.price*percent+50)/100), paymentStatus: 'pending_dp', sessionStatus: 'confirmed',
        notes: data.notes, location: data.location, createdBy: uid, createdAt: FieldValue.serverTimestamp(), version: 0 };
    } else {
      if (!booking) fail('not-found','Booking tidak tersedia.');
      if (booking.version !== data.expectedVersion) fail('aborted','Booking telah berubah. Muat data terbaru sebelum melanjutkan.','version-conflict');
      if (booking.sessionStatus !== 'confirmed') fail('failed-precondition','Booking selesai atau batal tidak dapat diubah.','terminal');
      if (action === 'complete' && booking.startAt.toMillis() > now) fail('failed-precondition','Sesi belum dimulai. Tandai selesai setelah jam mulai.');
      if (action === 'reschedule') target = interval(data.date,data.startTime,data.endTime,studio);
      if (action === 'edit' || action === 'reschedule') booking.location = data.location;
      if (action === 'edit') booking.notes = data.notes;
      if (action === 'cancel') { booking.sessionStatus = 'cancelled'; booking.cancellationReason = data.reason; }
      if (action === 'complete') booking.sessionStatus = 'done';
    }
    if (target && (target.startMs < now || target.startMs > now+731*86400000)) fail('invalid-argument','Pilih jadwal mendatang dalam dua tahun ke depan.');
    const dayKeys = [...new Set([booking.date, target?.date].filter(Boolean))].sort();
    const days = await Promise.all(dayKeys.map((key) => tx.get(root.collection('scheduleDays').doc(key))));
    const slots = new Map();
    for (const day of days) {
      const entries = day.data()?.slots ?? [];
      if (!Array.isArray(entries)) fail('failed-precondition','Indeks jadwal belum valid. Hubungi owner.');
      slots.set(day.id,entries.filter((slot) => slot.id !== bookingId));
    }
    // All writers lock the same day document, including when the day was empty.
    // Read/check/write happen together; locations do not create parallel capacity.
    if (target) {
      const conflict = slots.get(target.date).find((slot) => overlaps(slot,target));
      if (conflict) fail('already-exists','Jadwal bertabrakan dengan sesi lain. Pilih jam yang berbeda.','schedule-conflict');
      Object.assign(booking,{ date: target.date, startTime: target.startTime, endTime: target.endTime, startAt: Timestamp.fromMillis(target.startMs), endAt: Timestamp.fromMillis(target.endMs) });
    }
    if (booking.sessionStatus !== 'cancelled') slots.get(booking.date).push({ id: bookingId, startMs: booking.startAt.toMillis(), endMs: booking.endAt.toMillis() });
    for (const day of days) tx.set(day.ref,{ slots: slots.get(day.id), revision: (day.data()?.revision ?? 0)+1, updatedAt: FieldValue.serverTimestamp() });
    booking = { ...booking, version: booking.version+1, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() };
    if (counterRef) tx.set(counterRef,{ value: counter });
    tx.set(bookingRef,booking);
    tx.set(root.collection('sessions').doc(bookingId),publicSession(booking,bookingId));
    const result = { id: bookingId, version: booking.version, code: booking.code };
    tx.create(commandRef,{ fingerprint, result, uid, createdAt: FieldValue.serverTimestamp() });
    tx.create(bookingRef.collection('events').doc(mutationId),{ action, actorId: uid, reason: data.reason ?? '', version: booking.version, date: booking.date, startTime: booking.startTime, endTime: booking.endTime, sessionStatus: booking.sessionStatus, createdAt: FieldValue.serverTimestamp() });
    return result;
  }, { maxAttempts: 5 });
}

async function choices(db, uid, raw) {
  if (!raw || !['clients','packages'].includes(raw.kind)) fail('invalid-argument','Pilihan tidak valid.');
  const studioId = id(raw.studioId);
  const studio = await authorization(db,uid,studioId);
  const settings = { dpPercent: studio.defaultDpPercent ?? 30, openingTime: studio.openingTime ?? '08:00', closingTime: studio.closingTime ?? '21:00', timezone: studio.timezone ?? 'Asia/Jakarta' };
  const root = db.collection(`studios/${studioId}/${raw.kind}`);
  const selected = (snapshot) => {
    const d = snapshot.data();
    if (raw.kind === 'clients') return { id: snapshot.id, name: d.name, phone: d.phone, email: d.email ?? '', version: d.version };
    return { id: snapshot.id, name: d.name, price: d.price, durationMinutes: d.durationMinutes, editedPhotosCount: d.editedPhotosCount, defaultLocation: d.defaultLocation, description: d.description, version: d.version };
  };
  if (raw.id) {
    const snapshot = await root.doc(id(raw.id)).get();
    return { items: snapshot.exists && (raw.kind === 'clients' || snapshot.data().isActive === true) ? [selected(snapshot)] : [], next: null, settings };
  }
  const search = normalize(text(raw.search ?? '',0,100,'Pencarian'));
  let field = 'nameKey', prefix = search;
  if (raw.kind === 'clients' && /^[+\d][\d\s()+.-]*$/.test(search)) {
    field = 'phone'; prefix = search.replace(/[\s().-]/g,'');
    if (prefix.startsWith('0')) prefix = '+62'+prefix.slice(1);
    else if (prefix.startsWith('62')) prefix = '+'+prefix;
  }
  let query = root.orderBy(field).orderBy(FieldPath.documentId());
  if (raw.kind === 'packages') query = query.where('isActive','==',true);
  if (prefix) query = query.where(field,'>=',prefix).where(field,'<=',prefix+'\uf8ff');
  if (raw.next) {
    if (!Array.isArray(raw.next) || raw.next.length !== 2 || typeof raw.next[0] !== 'string') fail('invalid-argument','Halaman tidak valid.');
    query = query.startAfter(raw.next[0],id(raw.next[1]));
  }
  const page = await query.limit(26).get(), visible = page.docs.slice(0,25), last = visible.at(-1);
  return { items: visible.map(selected), next: page.size>25 ? [last.get(field),last.id] : null, settings };
}
async function availability(db,uid,data) {
  const studio = await authorization(db,uid,id(data.studioId));
  const range = interval(data.date,data.startTime,data.endTime,studio);
  const day = await db.doc(`studios/${data.studioId}/scheduleDays/${range.date}`).get();
  return { available: !(day.data()?.slots ?? []).some((slot) => slot.id !== data.exceptId && overlaps(slot,range)), openingTime: studio.openingTime ?? '08:00', closingTime: studio.closingTime ?? '21:00' };
}
module.exports = { command, choices, availability, publicSession };

const { HttpsError } = require('firebase-functions/v2/https');
function fail(code, message, reason) { throw new HttpsError(code, message, { reason }); }
function id(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('invalid-argument', 'Identitas data tidak valid.');
  return value;
}
function text(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail('invalid-argument', `${label} tidak valid.`);
  return value.trim();
}
function minute(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('invalid-argument', 'Gunakan jam HH:mm.');
  return Number(value.slice(0,2)) * 60 + Number(value.slice(3));
}
function interval(date, startTime, endTime, studio = {}) {
  if (typeof date !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(date)) fail('invalid-argument', 'Gunakan tanggal YYYY-MM-DD.');
  const start = minute(startTime), end = minute(endTime);
  const startMs = Date.parse(`${date}T${startTime}:00+07:00`), endMs = Date.parse(`${date}T${endTime}:00+07:00`);
  if (!Number.isFinite(startMs) || new Date(startMs + 7*3600000).toISOString().slice(0,10) !== date || end-start < 15 || start % 15 || end % 15) fail('invalid-argument', 'Tanggal/jam tidak valid. Sesi minimal 15 menit dan jam kelipatan 15 menit.');
  if (studio.timezone && studio.timezone !== 'Asia/Jakarta') fail('failed-precondition', 'Zona studio belum didukung untuk booking.');
  const opening = studio.openingTime ?? '08:00', closing = studio.closingTime ?? '21:00';
  if (start < minute(opening) || end > minute(closing)) fail('invalid-argument', `Jadwal harus berada dalam jam buka ${opening}–${closing} WIB.`);
  return { date, startTime, endTime, startMs, endMs };
}
function overlaps(a, b) { return a.startMs < b.endMs && b.startMs < a.endMs; }
function normalize(value) { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
function searchTokens(...values) {
  const tokens = new Set();
  for (const value of values) for (const part of [normalize(value), ...normalize(value).split(' ')]) for (let i=1;i<=Math.min(part.length,64);i++) tokens.add(part.slice(0,i));
  return [...tokens];
}
function validateCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('invalid-argument', 'Perintah tidak valid.');
  const actions = { create: ['clientId','packageId','clientVersion','packageVersion','date','startTime','endTime','location','notes','dpPercent'], reschedule: ['date','startTime','endTime','location','reason'], cancel: ['reason'], complete: [], edit: ['location','notes'] };
  if (!Object.hasOwn(actions, raw.action)) fail('invalid-argument', 'Aksi booking tidak dikenal.');
  const common = ['action','studioId','bookingId','mutationId','expectedVersion'];
  if (Object.keys(raw).some((key) => !common.includes(key) && !actions[raw.action].includes(key))) fail('invalid-argument', 'Field perintah tidak diizinkan.');
  const data = { action: raw.action, studioId: id(raw.studioId), bookingId: id(raw.bookingId), mutationId: id(raw.mutationId), expectedVersion: raw.expectedVersion };
  if (data.mutationId.length < 12 || (data.action === 'create' ? data.expectedVersion !== null : !Number.isInteger(data.expectedVersion) || data.expectedVersion < 1)) fail('invalid-argument', 'Versi atau identitas percobaan tidak valid.');
  for (const key of actions[raw.action]) data[key] = raw[key];
  if (['create','reschedule'].includes(data.action)) {
    Object.assign(data, interval(data.date, data.startTime, data.endTime, { openingTime: '00:00', closingTime: '23:59' }));
    delete data.startMs; delete data.endMs;
  }
  if (['create','reschedule','edit'].includes(data.action)) data.location = text(data.location,1,200,'Lokasi');
  if (['create','edit'].includes(data.action)) data.notes = text(data.notes,0,2000,'Catatan');
  if (['reschedule','cancel'].includes(data.action)) data.reason = text(data.reason,3,500,'Alasan');
  if (data.action === 'create') {
    data.clientId = id(data.clientId); data.packageId = id(data.packageId);
    if (![data.clientVersion,data.packageVersion].every((v) => Number.isInteger(v) && v>=1)) fail('invalid-argument','Pilih ulang pelanggan dan paket.');
    if (!Number.isInteger(data.dpPercent) || data.dpPercent<0 || data.dpPercent>100) fail('invalid-argument','Target DP tidak valid.');
  }
  return data;
}
module.exports = { fail, id, text, minute, interval, overlaps, normalize, searchTokens, validateCommand };

const { context, input } = require('./management.cjs');
const { fail } = require('./domain.cjs');
const { dateWib } = require('./overview.cjs');
const DAY = 86400000;
function validDate(value) { return typeof value === 'string' && /^20\d\d-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value; }
function bucket(date, unit) {
  if (unit === 'month') return date.slice(0,7);
  if (unit === 'week') { const t = new Date(`${date}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - (t.getUTCDay()+6)%7); return t.toISOString().slice(0,10); }
  return date;
}
async function read(db, uid, raw) {
  const d = input(raw, ['studioId','from','to']), c = await context(db, uid, d.studioId);
  if (c.member.role !== 'owner' && c.member.permissions?.reports !== true) fail('permission-denied', 'Anda memerlukan izin laporan.');
  const days = (Date.parse(d.to)-Date.parse(d.from))/DAY+1;
  if (!validDate(d.from) || !validDate(d.to) || days < 1 || days > 366 || d.to > dateWib()) fail('invalid-argument', 'Pilih periode sah maksimal 366 hari sampai hari ini.');
  const unit = days <= 31 ? 'day' : days <= 100 ? 'week' : 'month', groups = new Map();
  for(let i=0;i<days;i++){const date=new Date(Date.parse(d.from)+i*DAY).toISOString().slice(0,10),key=bucket(date,unit);if(!groups.has(key))groups.set(key,{key,from:date,to:date,income:0,refund:0,expense:0,count:0});else groups.get(key).to=date;}
  const page = await c.root.collection('transactions').where('effectiveDate','>=',d.from).where('effectiveDate','<=',d.to).orderBy('effectiveDate').limit(5001).get();
  if (page.size > 5000) fail('resource-exhausted', 'Periode memuat lebih dari 5.000 transaksi. Perpendek rentang laporan.');
  const totals = { income: 0, refund: 0, expense: 0, count: page.size };
  for (const doc of page.docs) {
    const entry=doc.data(),kind=['income_dp','income_settlement'].includes(entry.kind)?'income':entry.kind;
    if (!['income','refund','expense'].includes(kind)||!Number.isSafeInteger(entry.amount)||entry.amount<=0) fail('failed-precondition','Ledger perlu diperiksa sebelum laporan dihitung.');
    totals[kind]+=entry.amount;const group=groups.get(bucket(entry.effectiveDate,unit));group[kind]+=entry.amount;group.count++;
  }
  if (!Object.values(totals).every(Number.isSafeInteger)) fail('resource-exhausted','Perpendek periode laporan.');
  return { from:d.from,to:d.to,unit,...totals,netIncome:totals.income-totals.refund,cashNet:totals.income-totals.refund-totals.expense,buckets:[...groups.values()],generatedAt:Date.now(),timezone:'Asia/Jakarta' };
}
module.exports = { read };

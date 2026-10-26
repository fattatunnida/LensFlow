const { FieldValue,Timestamp,FieldPath }=require('firebase-admin/firestore');
const { createHash }=require('node:crypto');
const { fail,id,text,normalize }=require('./domain.cjs');
const { publicSession }=require('./service.cjs');
const INCOME=['income_dp','income_settlement'];
const CATEGORIES=['operasional','sewa_alat','cetak','utilitas','konsumsi','lainnya'];
const dateWib=(ms=Date.now())=>new Date(ms+7*3600000).toISOString().slice(0,10);
function validDate(value){
  if(typeof value!=='string'||!/^20\d\d-\d\d-\d\d$/.test(value))fail('invalid-argument','Gunakan tanggal YYYY-MM-DD.');
  const ms=Date.parse(`${value}T00:00:00+07:00`);
  if(!Number.isFinite(ms)||dateWib(ms)!==value)fail('invalid-argument','Tanggal transaksi tidak sah.');
  return ms;
}
function amount(value){if(!Number.isSafeInteger(value)||value<=0||value>1000000000)fail('invalid-argument','Nominal harus rupiah bulat positif, maksimal Rp 1.000.000.000.');return value;}
async function access(db,uid,studioId,tx,mode='read'){
  if(!uid)fail('unauthenticated','Silakan masuk kembali.');id(uid);id(studioId);
  const read=ref=>tx?tx.get(ref):ref.get();
  const [profile,member,studio]=await Promise.all([read(db.doc(`users/${uid}`)),read(db.doc(`studios/${studioId}/members/${uid}`)),read(db.doc(`studios/${studioId}`))]);
  const m=member.data(),isOwner=m?.role==='owner';
  if(!studio.exists||profile.data()?.studioId!==studioId||m?.status!=='active'||!['owner','staff'].includes(m.role)||(!isOwner&&(mode==='owner'||(m.permissions?.payments!==true&&(mode!=='read'||m.permissions?.reports!==true)))))fail('permission-denied','Anda tidak memiliki izin keuangan untuk tindakan ini.');
  const settings=studio.data();if(settings.timezone&&settings.timezone!=='Asia/Jakarta')fail('failed-precondition','Zona keuangan studio belum didukung.');
  return {isOwner,settings,displayName:profile.data().displayName??uid};
}
function validate(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!['income_dp','income_settlement','refund','expense'].includes(raw.kind))fail('invalid-argument','Jenis transaksi tidak valid.');
  const optional=raw.kind==='expense'?['category']:raw.kind==='refund'?['bookingId','expectedVersion','originalEntryId']:['bookingId','expectedVersion'];
  const common=['studioId','entryId','mutationId','kind','amount','method','effectiveDate','description','acknowledged'];
  if(Object.keys(raw).some(k=>!common.includes(k)&&!optional.includes(k)))fail('invalid-argument','Field transaksi tidak diizinkan.');
  if(raw.acknowledged!==true)fail('failed-precondition','Konfirmasikan bahwa uang sudah benar-benar diterima atau dikeluarkan.');
  const d={studioId:id(raw.studioId),entryId:id(raw.entryId),mutationId:id(raw.mutationId),kind:raw.kind,amount:amount(raw.amount),method:raw.method,effectiveDate:raw.effectiveDate,description:text(raw.description,INCOME.includes(raw.kind)?0:3,500,'Uraian/alasan'),acknowledged:true};
  if(d.mutationId.length<12||!['transfer','qris'].includes(d.method))fail('invalid-argument','Metode atau identitas percobaan tidak valid.');validDate(d.effectiveDate);
  if(d.kind==='expense'){if(!CATEGORIES.includes(raw.category))fail('invalid-argument','Pilih kategori pengeluaran.');d.category=raw.category;}
  else{d.bookingId=id(raw.bookingId);if(!Number.isInteger(raw.expectedVersion)||raw.expectedVersion<1)fail('invalid-argument','Versi booking tidak valid.');d.expectedVersion=raw.expectedVersion;}
  if(d.kind==='refund')d.originalEntryId=id(raw.originalEntryId);
  return d;
}
function balances(b){
  const received=b.paidAmount??0,refunded=b.refundedAmount??0;
  if(!Number.isSafeInteger(b.total)||b.total<=0||!Number.isSafeInteger(received)||!Number.isSafeInteger(refunded)||refunded<0||received<refunded||received>b.total)fail('failed-precondition','Saldo booking perlu direkonsiliasi sebelum transaksi.','reconcile');
  return {received,refunded,net:received-refunded,remaining:b.total-received+refunded};
}
function context(snapshot){
  const b=snapshot.data(),v=balances(b);
  return {id:snapshot.id,code:b.code,clientName:b.clientName,packageName:b.packageName,date:b.date,startTime:b.startTime,endTime:b.endTime,sessionStatus:b.sessionStatus,paymentStatus:b.paymentStatus,version:b.version,total:b.total,receivedAmount:v.received,refundedAmount:v.refunded,netPaid:v.net,remaining:v.remaining,collectible:b.sessionStatus==='cancelled'?0:v.remaining,dpTarget:b.dpTarget,dpPercent:b.dpPercent,refundStatus:v.refunded===0?'none':v.refunded===v.received?'full':'partial'};
}
async function command(db,uid,raw){
  const d=validate(raw),root=db.doc(`studios/${d.studioId}`),entryRef=root.collection('transactions').doc(d.entryId),receiptRef=root.collection('financeMutations').doc(`${uid}_${d.mutationId}`);
  const hash=createHash('sha256').update(JSON.stringify(d)).digest('hex');
  return db.runTransaction(async tx=>{
    const {isOwner,settings,displayName}=await access(db,uid,d.studioId,tx,INCOME.includes(d.kind)?'payments':'owner');
    const [prior,existing]=await Promise.all([tx.get(receiptRef),tx.get(entryRef)]);
    if(prior.exists){if(prior.data().hash!==hash)fail('already-exists','Identitas percobaan sudah dipakai untuk isian lain.','mutation-conflict');return prior.data().result;}
    if(existing.exists)fail('already-exists','Transaksi sudah tercatat. Periksa detail sebelum membuat ulang.','entry-exists');
    const today=dateWib(),effectiveMs=validDate(d.effectiveDate),maxBack=settings.maxFinanceBackdateDays??30;
    if(!Number.isInteger(maxBack)||maxBack<0||maxBack>366)fail('failed-precondition','Batas tanggal keuangan studio belum valid.');
    if(d.effectiveDate>today||(!isOwner&&d.effectiveDate!==today)||(isOwner&&validDate(today)-effectiveMs>maxBack*86400000))fail('invalid-argument',`Tanggal tidak diizinkan. Staf mencatat hari ini; owner maksimal ${maxBack} hari sebelumnya.`);
    const month=d.effectiveDate.slice(0,7),monthRefs=[root.collection('financeMonths').doc(`${month}_all`),root.collection('financeMonths').doc(`${month}_${d.method}`)];
    const monthDocs=await Promise.all(monthRefs.map(ref=>tx.get(ref)));
    let b,bookingRef,accountRef,account,original,refundRef,refundedOriginal=0;
    if(d.kind!=='expense'){
      bookingRef=root.collection('bookings').doc(d.bookingId);accountRef=root.collection('financeAccounts').doc(d.bookingId);
      const [bookingDoc,accountDoc]=await Promise.all([tx.get(bookingRef),tx.get(accountRef)]);b=bookingDoc.data();account=accountDoc.data()??{received:0,refunded:0};
      if(!b)fail('not-found','Booking tidak tersedia.');
      if(b.version!==d.expectedVersion)fail('aborted','Booking atau saldo berubah. Muat data terbaru sebelum melanjutkan.','version-conflict');
      const v=balances(b);
      if(account.received!==v.received||account.refunded!==v.refunded)fail('failed-precondition','Saldo perlu direkonsiliasi dengan ledger.','reconcile');
      if(INCOME.includes(d.kind)){
        if(!['confirmed','done'].includes(b.sessionStatus))fail('failed-precondition','Pembayaran tidak dapat dicatat untuk booking batal.');
        if(b.createdAt?.toMillis&&d.effectiveDate<dateWib(b.createdAt.toMillis()))fail('invalid-argument','Pembayaran tidak boleh mendahului tanggal pembuatan booking.');
        if(v.remaining<=0)fail('failed-precondition','Booking sudah lunas.');
        if(d.kind==='income_dp'&&d.amount>=v.remaining)fail('invalid-argument','DP harus lebih kecil dari sisa. Gunakan Pelunasan untuk seluruh sisa.');
        if(d.kind==='income_settlement'&&d.amount!==v.remaining)fail('invalid-argument','Nominal pelunasan harus sama dengan seluruh sisa terkini.');
        b.paidAmount=v.received+d.amount;b.refundedAmount=v.refunded;
        b.paymentStatus=b.paidAmount-b.refundedAmount===b.total?'paid':'dp_paid';
      }else{
        if(b.sessionStatus!=='cancelled')fail('failed-precondition','Refund hanya dapat dicatat setelah booking dibatalkan.');
        refundRef=root.collection('refundBalances').doc(d.originalEntryId);
        const [source,refundDoc]=await Promise.all([tx.get(root.collection('transactions').doc(d.originalEntryId)),tx.get(refundRef)]);original=source.data();refundedOriginal=refundDoc.data()?.amount??0;
        if(!original||!INCOME.includes(original.kind)||original.bookingId!==d.bookingId||original.studioId!==d.studioId)fail('failed-precondition','Pembayaran asal tidak sesuai booking/studio.');
        if(!Number.isSafeInteger(refundedOriginal)||refundedOriginal<0||d.amount>original.amount-refundedOriginal||d.amount>v.net)fail('invalid-argument','Nominal melebihi sisa pembayaran yang dapat direfund.');
        if(d.effectiveDate<original.effectiveDate)fail('invalid-argument','Tanggal refund tidak boleh sebelum pembayaran asal.');
        b.paidAmount=v.received;b.refundedAmount=v.refunded+d.amount;
      }
      b.netPaidAmount=b.paidAmount-b.refundedAmount;b.refundStatus=b.refundedAmount===0?'none':b.refundedAmount===b.paidAmount?'full':'partial';
      b={...b,version:b.version+1,updatedAt:FieldValue.serverTimestamp(),updatedBy:uid};
    }
    const entry={studioId:d.studioId,kind:d.kind,amount:d.amount,method:d.method,effectiveDate:d.effectiveDate,effectiveAt:Timestamp.fromMillis(effectiveMs),description:d.description,category:d.category??'',bookingId:d.bookingId??'',bookingCode:b?.code??'',clientName:b?.clientName??'',originalEntryId:d.originalEntryId??'',createdAt:FieldValue.serverTimestamp(),createdBy:uid,createdByName:displayName,mutationId:d.mutationId,acknowledgedBy:uid};
    const result={entryId:d.entryId,bookingId:d.bookingId??'',bookingVersion:b?.version??null};
    tx.create(entryRef,entry);tx.create(receiptRef,{hash,result,uid,createdAt:FieldValue.serverTimestamp()});
    for(const snapshot of monthDocs){
      const old=snapshot.data()??{income:0,refund:0,expense:0,count:0,version:0},field=INCOME.includes(d.kind)?'income':d.kind;
      if(!['income','refund','expense','count','version'].every(key=>Number.isSafeInteger(old[key])&&old[key]>=0))fail('failed-precondition','Ringkasan kas perlu direkonsiliasi.');
      const next={...old,[field]:old[field]+d.amount,count:old.count+1,version:old.version+1,updatedAt:FieldValue.serverTimestamp()};
      if(!Number.isSafeInteger(next[field]))fail('resource-exhausted','Batas nominal ringkasan tercapai.');tx.set(snapshot.ref,next);
    }
    if(b){
      tx.set(bookingRef,b);tx.set(root.collection('sessions').doc(d.bookingId),publicSession(b,d.bookingId));
      tx.set(accountRef,{received:b.paidAmount,refunded:b.refundedAmount,version:(account.version??0)+1,updatedAt:FieldValue.serverTimestamp()});
      tx.create(bookingRef.collection('events').doc(`finance_${d.entryId}`),{action:d.kind,actorId:uid,reason:d.description,version:b.version,date:b.date,startTime:b.startTime,endTime:b.endTime,sessionStatus:b.sessionStatus,createdAt:FieldValue.serverTimestamp()});
    }
    if(refundRef)tx.set(refundRef,{amount:refundedOriginal+d.amount,updatedAt:FieldValue.serverTimestamp(),lastEntryId:d.entryId});
    return result;
  },{maxAttempts:5});
}
async function bookings(db,uid,raw){
  const studioId=id(raw?.studioId);await access(db,uid,studioId);const root=db.doc(`studios/${studioId}`);
  if(raw.id){const snapshot=await root.collection('bookings').doc(id(raw.id)).get();return {items:snapshot.exists?[context(snapshot)]:[],next:null};}
  const search=normalize(text(raw.search??'',0,64,'Pencarian'));let query=root.collection('sessions').orderBy('startAt','desc').orderBy(FieldPath.documentId(),'desc');
  if(search)query=query.where('searchTokens','array-contains',search);
  if(raw.next){if(!Array.isArray(raw.next)||raw.next.length!==2||!Number.isSafeInteger(raw.next[0]))fail('invalid-argument','Halaman tidak valid.');query=query.startAfter(Timestamp.fromMillis(raw.next[0]),id(raw.next[1]));}
  const page=await query.limit(26).get(),visible=page.docs.slice(0,25),records=await Promise.all(visible.map(s=>root.collection('bookings').doc(s.id).get()));
  if(records.some(r=>!r.exists))fail('failed-precondition','Indeks booking perlu disinkronkan.');const last=visible.at(-1);
  return {items:records.map(context),next:page.size>25?[last.get('startAt').toMillis(),last.id]:null};
}
async function sources(db,uid,raw){
  const studioId=id(raw?.studioId),bookingId=id(raw?.bookingId);await access(db,uid,studioId,null,'owner');const root=db.doc(`studios/${studioId}`);
  const booking=await root.collection('bookings').doc(bookingId).get();if(!booking.exists)fail('not-found','Booking tidak tersedia.');
  let query=root.collection('transactions').where('bookingId','==',bookingId).where('kind','in',INCOME).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
  if(raw.next){if(!Array.isArray(raw.next)||raw.next.length!==3||!raw.next.slice(0,2).every(Number.isInteger))fail('invalid-argument','Halaman tidak valid.');query=query.startAfter(new Timestamp(raw.next[0],raw.next[1]),id(raw.next[2]));}
  const page=await query.limit(26).get(),visible=page.docs.slice(0,25),counters=await Promise.all(visible.map(s=>root.collection('refundBalances').doc(s.id).get())),last=visible.at(-1),stamp=last?.get('createdAt');
  return {items:visible.map((s,i)=>({id:s.id,amount:s.get('amount'),method:s.get('method'),effectiveDate:s.get('effectiveDate'),refundedAmount:counters[i].data()?.amount??0,remaining:s.get('amount')-(counters[i].data()?.amount??0)})),next:page.size>25?[stamp.seconds,stamp.nanoseconds,last.id]:null};
}
module.exports={command,bookings,sources};

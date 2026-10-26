import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createRequire } from 'node:module';
import { initializeApp as adminInit,deleteApp as adminDelete } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore,Timestamp } from 'firebase-admin/firestore';
const require=createRequire(import.meta.url),{initializeApp,deleteApp}=require('firebase/app'),{getAuth,connectAuthEmulator,signInWithEmailAndPassword}=require('firebase/auth'),{getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions'),{getFirestore,connectFirestoreEmulator,doc,getDocFromServer,setDoc,updateDoc,deleteDoc,getDocs,collection,query,limit}=require('firebase/firestore');
for(const host of [process.env.FIREBASE_AUTH_EMULATOR_HOST,process.env.FIRESTORE_EMULATOR_HOST])if(!host||!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw new Error('Finance tests require loopback emulators.');
const admin=adminInit({projectId:'demo-lensflow'},'finance-tests'),db=adminFirestore(admin),auth=adminAuth(admin),studioId='finance-test-a',root=db.doc(`studios/${studioId}`),apps=[],clients={};
const day=(offset=0)=>new Date(Date.now()+offset*86400000+7*3600000).toISOString().slice(0,10);
const call=(role,name,data)=>httpsCallable(clients[role].functions,name,{timeout:45000})(data).then(r=>r.data);
const denied=e=>['permission-denied','functions/permission-denied'].includes(e.code),why=reason=>e=>e.details?.reason===reason;
let sequence=0;
async function booking(id){return call('owner','bookingCommand',{studioId,action:'create',bookingId:id,mutationId:`create-${id}-0001`,expectedVersion:null,clientId:'customer',packageId:'package',clientVersion:1,packageVersion:1,dpPercent:30,date:day(3+sequence++),startTime:'09:00',endTime:'10:00',location:'Studio',notes:''});}
const post=(entryId,kind,patch={},role='owner')=>call(role,'financeCommand',{studioId,entryId,mutationId:`finance-${entryId}-0001`,kind,amount:100000,method:'transfer',effectiveDate:day(),description:kind==='income_dp'||kind==='income_settlement'?'':'Uang sudah diverifikasi',acknowledged:true,...patch});
const income=(entryId,bookingId,expectedVersion=1,amount=100000,role='owner')=>post(entryId,'income_dp',{bookingId,expectedVersion,amount},role);
const cancel=(id,version)=>call('owner','bookingCommand',{studioId,action:'cancel',bookingId:id,expectedVersion:version,mutationId:`cancel-${id}-00001`,reason:'Pembatalan pelanggan'});
before(async()=>{
  for(const id of [studioId,'finance-test-b'])await db.recursiveDelete(db.doc(`studios/${id}`));
  for(const role of ['owner','payments','reports','booking','crm','none','inactive','other']){
    const uid=`f5-${role}`,sid=role==='other'?'finance-test-b':studioId;
    try{await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid,email:`${uid}@lensflow.test`,password:'FinanceTests2026!'});}
    await db.doc(`users/${uid}`).set({studioId:sid,displayName:uid,email:`${uid}@lensflow.test`});await db.doc(`studios/${sid}`).set({name:sid,timezone:'Asia/Jakarta'});
    await db.doc(`studios/${sid}/members/${uid}`).set({role:role==='owner'?'owner':'staff',status:role==='inactive'?'inactive':'active',permissions:{booking:role==='booking',calendarCrm:role==='crm',payments:['payments','inactive','other'].includes(role),reports:role==='reports'}});
    const app=initializeApp({projectId:'demo-lensflow',apiKey:'demo-key'},`finance-${role}`);apps.push(app);const a=getAuth(app);connectAuthEmulator(a,`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,{disableWarnings:true});const f=getFunctions(app,'asia-southeast2');connectFunctionsEmulator(f,'127.0.0.1',5001);const sdk=getFirestore(app),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');connectFirestoreEmulator(sdk,host,Number(port));await signInWithEmailAndPassword(a,`${uid}@lensflow.test`,'FinanceTests2026!');clients[role]={functions:f,db:sdk};
  }
  await root.collection('clients').doc('customer').set({name:'Finance Customer',nameKey:'finance customer',phone:'+6281234567890',email:'',version:1});await root.collection('packages').doc('package').set({name:'Finance Portrait',nameKey:'finance portrait',price:500000,durationMinutes:60,editedPhotosCount:10,defaultLocation:'Studio',description:'',isActive:true,version:1});
});
after(async()=>{await Promise.all(apps.map(deleteApp));await adminDelete(admin);});
test('payments staff record multiple DPs and exact settlement with immutable ledger and synchronized booking/projection',async()=>{
  await booking('pay-main');await income('dp-one','pay-main',1,100000,'payments');await income('dp-two','pay-main',2,50000,'payments');
  await post('settled','income_settlement',{bookingId:'pay-main',expectedVersion:3,amount:350000},'payments');
  const b=(await root.collection('bookings').doc('pay-main').get()).data(),s=(await root.collection('sessions').doc('pay-main').get()).data();assert.equal(b.paidAmount,500000);assert.equal(b.paymentStatus,'paid');assert.equal(b.version,4);assert.equal(s.stateKey,'paid');assert.equal(s.version,4);assert.equal('paidAmount'in s,false);
  const entry=(await root.collection('transactions').doc('dp-one').get()).data();assert.equal(entry.amount,100000);assert.equal(entry.createdBy,'f5-payments');assert.ok(entry.createdAt instanceof Timestamp);assert.equal(entry.acknowledgedBy,'f5-payments');
  const events=await root.collection('bookings').doc('pay-main').collection('events').orderBy('version').get();assert.deepEqual(events.docs.map(d=>d.get('version')),[1,2,3,4]);
});
test('full first payment must use settlement and invalid DP/settlement amounts never change balances',async()=>{
  await booking('validation');
  for(const [kind,amount]of [['income_dp',0],['income_dp',-1],['income_dp',1.5],['income_dp',500000],['income_dp',600000],['income_settlement',499999]])await assert.rejects(post(`bad-${kind}-${String(amount).replace('.','-')}`,kind,{bookingId:'validation',expectedVersion:1,amount}),e=>e.code==='functions/invalid-argument');
  assert.equal((await root.collection('bookings').doc('validation').get()).data().version,1);await post('direct-full','income_settlement',{bookingId:'validation',expectedVersion:1,amount:500000});assert.equal((await root.collection('bookings').doc('validation').get()).data().paymentStatus,'paid');
});
test('retry uses a committed receipt, while changed payload or reused entry ID is rejected',async()=>{
  const result=await income('dp-one','pay-main',1,100000,'payments');assert.equal(result.bookingVersion,2);
  await assert.rejects(income('dp-one','pay-main',1,90000,'payments'),why('mutation-conflict'));
  await assert.rejects(post('dp-one','income_dp',{bookingId:'pay-main',expectedVersion:4,mutationId:'different-key-00001'}),why('entry-exists'));
  assert.equal((await root.collection('bookings').doc('pay-main').get()).data().version,4);
});
test('two simultaneous settlements admit one, prevent overpayment and create exactly one ledger entry',async()=>{
  await booking('race-payment');const payload={bookingId:'race-payment',expectedVersion:1,amount:500000};
  const results=await Promise.allSettled([post('race-payment-a','income_settlement',payload),post('race-payment-b','income_settlement',payload,'payments')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&why('version-conflict')(r.reason)).length,1);
  assert.equal((await root.collection('bookings').doc('race-payment').get()).data().paidAmount,500000);assert.equal((await root.collection('transactions').where('bookingId','==','race-payment').get()).size,1);
});
test('payment and cancellation racing cannot post money against a cancelled version',async()=>{
  await booking('race-cancel');const results=await Promise.allSettled([income('race-cancel-dp','race-cancel'),cancel('race-cancel',1)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const b=(await root.collection('bookings').doc('race-cancel').get()).data();assert.equal(b.version,2);assert.ok((b.sessionStatus==='cancelled'&&b.paidAmount===0)||(b.sessionStatus==='confirmed'&&b.paidAmount===100000));
});
test('refunds require cancellation, owner, original payment and per-source available amount; original remains unchanged',async()=>{
  await booking('refund-book');await income('refund-source-one','refund-book',1,100000);await income('refund-source-two','refund-book',2,100000);
  await assert.rejects(post('too-early','refund',{bookingId:'refund-book',expectedVersion:3,originalEntryId:'refund-source-one',amount:50000}),e=>e.code==='functions/failed-precondition');await cancel('refund-book',3);
  const original=(await root.collection('transactions').doc('refund-source-one').get()).data();
  await post('refund-partial','refund',{bookingId:'refund-book',expectedVersion:4,originalEntryId:'refund-source-one',amount:40000});
  await assert.rejects(post('refund-excess','refund',{bookingId:'refund-book',expectedVersion:5,originalEntryId:'refund-source-one',amount:70000}),e=>e.code==='functions/invalid-argument');
  await assert.rejects(post('refund-wrong-book','refund',{bookingId:'refund-book',expectedVersion:5,originalEntryId:'dp-one',amount:10000}),e=>e.code==='functions/failed-precondition');
  await post('refund-rest','refund',{bookingId:'refund-book',expectedVersion:5,originalEntryId:'refund-source-one',amount:60000});
  await post('refund-full','refund',{bookingId:'refund-book',expectedVersion:6,originalEntryId:'refund-source-two',amount:100000});
  const b=(await root.collection('bookings').doc('refund-book').get()).data();assert.equal(b.refundedAmount,200000);assert.equal(b.netPaidAmount,0);assert.equal(b.refundStatus,'full');assert.equal(b.paymentStatus,'dp_paid');assert.deepEqual((await root.collection('transactions').doc('refund-source-one').get()).data(),original);
  const choices=await call('owner','financeSources',{studioId,bookingId:'refund-book'});assert.equal(choices.items.find(s=>s.id==='refund-source-one').remaining,0);
});
test('concurrent refunds cannot exceed the original payment and receipt replay does not refund again',async()=>{
  await booking('refund-race');await income('refund-race-source','refund-race',1,100000);await cancel('refund-race',2);const payload={bookingId:'refund-race',expectedVersion:3,originalEntryId:'refund-race-source',amount:70000};
  const results=await Promise.allSettled([post('refund-race-a','refund',payload),post('refund-race-b','refund',payload)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const winner=results[0].status==='fulfilled'?'refund-race-a':'refund-race-b';await post(winner,'refund',payload);assert.equal((await root.collection('refundBalances').doc('refund-race-source').get()).data().amount,70000);assert.equal((await root.collection('bookings').doc('refund-race').get()).data().refundedAmount,70000);
});
test('expense is owner-only, repeat-safe and independent from booking balances',async()=>{
  const before=(await root.collection('bookings').doc('pay-main').get()).data();const result=await post('expense-one','expense',{category:'utilitas',amount:250000,description:'Listrik studio'});assert.deepEqual(await post('expense-one','expense',{category:'utilitas',amount:250000,description:'Listrik studio'}),result);assert.deepEqual((await root.collection('bookings').doc('pay-main').get()).data(),before);
  await assert.rejects(post('expense-staff','expense',{category:'utilitas'},'payments'),denied);await assert.rejects(post('bad-category','expense',{category:'refund'}),e=>e.code==='functions/invalid-argument');
});
test('server validates acknowledgement, methods, dates, unknown fields and reconciled caches',async()=>{
  for(const patch of [{acknowledged:false},{method:'cash'},{effectiveDate:'2026-02-30'},{effectiveDate:day(1)},{effectiveDate:day(-31)},{paidAmount:1}])await assert.rejects(post('bad-expense','expense',{category:'operasional',...patch}),e=>['functions/invalid-argument','functions/failed-precondition'].includes(e.code));
  await booking('bad-cache');await root.collection('bookings').doc('bad-cache').update({paidAmount:50000});await assert.rejects(income('bad-cache-post','bad-cache'),why('reconcile'));
  await booking('backdate-staff');await assert.rejects(post('staff-past','income_dp',{bookingId:'backdate-staff',expectedVersion:1,effectiveDate:day(-1)},'payments'),e=>e.code==='functions/invalid-argument');
  await post('expense-past','expense',{category:'operasional',effectiveDate:day(-1),amount:10000});
});
test('finance roles, studio isolation, strict booleans and raw write denial are enforced',async()=>{
  await booking('access-book');for(const role of ['booking','crm','none','inactive','other','reports'])await assert.rejects(income(`deny-${role}`,'access-book',1,10000,role),denied);
  await root.collection('members').doc('f5-none').update({'permissions.payments':'true'});try{await assert.rejects(income('deny-malformed','access-book',1,10000,'none'),denied);}finally{await root.collection('members').doc('f5-none').update({'permissions.payments':false});}
  const owner=clients.owner.db;for(const path of ['transactions/forged','financeAccounts/forged','refundBalances/forged','financeMutations/forged','financeMonths/forged'])await assert.rejects(setDoc(doc(owner,`studios/${studioId}/${path}`),{amount:1}),denied);
  const entry=doc(owner,`studios/${studioId}/transactions/dp-one`);await assert.rejects(updateDoc(entry,{amount:1}),denied);await assert.rejects(deleteDoc(entry),denied);
  assert.equal((await getDocFromServer(doc(clients.reports.db,`studios/${studioId}/transactions/dp-one`))).data().amount,100000);await assert.rejects(getDocFromServer(doc(clients.booking.db,`studios/${studioId}/transactions/dp-one`)),denied);await assert.rejects(getDocFromServer(doc(clients.other.db,`studios/${studioId}/transactions/dp-one`)),denied);
  await assert.rejects(getDocs(collection(owner,`studios/${studioId}/transactions`)),denied);assert.ok((await getDocs(query(collection(owner,`studios/${studioId}/transactions`),limit(25)))).size>0);
});
test('payments-only staff receive minimum booking context without scheduling, contact or CRM access',async()=>{
  const page=await call('payments','financeBookings',{studioId,id:'pay-main'});assert.equal(page.items[0].collectible,0);for(const key of ['clientPhone','clientEmail','notes','packageSnapshot'])assert.equal(key in page.items[0],false);
  await assert.rejects(getDocFromServer(doc(clients.payments.db,`studios/${studioId}/bookings/pay-main`)),denied);await assert.rejects(call('payments','financeSources',{studioId,bookingId:'refund-book'}),denied);
  const search=await call('payments','financeBookings',{studioId,search:'finance'});assert.ok(search.items.length>0);await assert.rejects(call('booking','financeBookings',{studioId}),denied);
});
test('monthly/method cash caches exactly reconcile to immutable ledger; refunds are excluded from expenses',async()=>{
  const entries=(await root.collection('transactions').get()).docs.map(d=>d.data()),groups=new Map();
  for(const entry of entries)for(const method of ['all',entry.method]){const key=`${entry.effectiveDate.slice(0,7)}_${method}`,group=groups.get(key)??{income:0,refund:0,expense:0,count:0};group[['income_dp','income_settlement'].includes(entry.kind)?'income':entry.kind]+=entry.amount;group.count++;groups.set(key,group);}
  for(const [key,expected]of groups){const actual=(await root.collection('financeMonths').doc(key).get()).data();for(const field of ['income','refund','expense','count'])assert.equal(actual[field],expected[field]);}
  assert.equal(entries.filter(e=>e.kind==='expense').length,2);assert.ok(entries.some(e=>e.kind==='refund'));
});
test('revoked permissions reject even receipt replay, while refund and private counters remain owner/server-only',async()=>{
  await root.collection('members').doc('f5-payments').update({'permissions.payments':false});
  try{await assert.rejects(income('dp-one','pay-main',1,100000,'payments'),denied);}finally{await root.collection('members').doc('f5-payments').update({'permissions.payments':true});}
  await assert.rejects(post('forged-refund','refund',{bookingId:'refund-book',expectedVersion:7,originalEntryId:'refund-source-one',amount:10000},'payments'),denied);
  await assert.rejects(getDocFromServer(doc(clients.owner.db,`studios/${studioId}/refundBalances/refund-source-one`)),denied);
  const app=initializeApp({projectId:'demo-lensflow',apiKey:'demo-key'},'finance-anonymous');apps.push(app);const functions=getFunctions(app,'asia-southeast2');connectFunctionsEmulator(functions,'127.0.0.1',5001);
  await assert.rejects(httpsCallable(functions,'financeCommand')({studioId,entryId:'anon',mutationId:'anonymous-money-0001',kind:'expense',amount:10000,method:'transfer',effectiveDate:day(),description:'Anonymous expense',category:'operasional',acknowledged:true}),e=>e.code==='functions/unauthenticated');
});
test('a completed session may receive payment, while refunds cannot predate their original receipt',async()=>{
  await booking('done-unpaid');await root.collection('bookings').doc('done-unpaid').update({sessionStatus:'done'});await income('done-dp','done-unpaid',1,100000,'payments');const b=(await root.collection('bookings').doc('done-unpaid').get()).data();assert.equal(b.sessionStatus,'done');assert.equal(b.paymentStatus,'dp_paid');assert.equal((await root.collection('sessions').doc('done-unpaid').get()).data().stateKey,'done');
  await booking('refund-dates');await income('refund-dates-source','refund-dates',1,100000);await cancel('refund-dates',2);
  await assert.rejects(post('refund-before-source','refund',{bookingId:'refund-dates',expectedVersion:3,originalEntryId:'refund-dates-source',amount:10000,effectiveDate:day(-1)}),e=>e.code==='functions/invalid-argument'&&e.message.includes('Tanggal refund'));
});
test('finance booking and refund-source cursors preserve all records across pages with tied effective dates',async()=>{
  await root.collection('clients').doc('customer').update({name:'Paged Customer',nameKey:'paged customer'});
  try{for(let i=0;i<27;i++)await booking(`paged-booking-${i}`);}finally{await root.collection('clients').doc('customer').update({name:'Finance Customer',nameKey:'finance customer'});}
  const first=await call('payments','financeBookings',{studioId,search:'paged'}),next=await call('payments','financeBookings',{studioId,search:'paged',next:first.next});assert.equal(first.items.length,25);assert.equal(next.items.length,2);assert.equal(new Set([...first.items,...next.items].map(b=>b.id)).size,27);
  await booking('sources-paged');for(let i=0;i<27;i++)await income(`sources-paged-${i}`,'sources-paged',i+1,1000);
  const sources=await call('owner','financeSources',{studioId,bookingId:'sources-paged'}),rest=await call('owner','financeSources',{studioId,bookingId:'sources-paged',next:sources.next});assert.equal(sources.items.length,25);assert.equal(rest.items.length,2);assert.equal(new Set([...sources.items,...rest.items].map(s=>s.id)).size,27);assert.equal([...sources.items,...rest.items].reduce((sum,s)=>sum+s.remaining,0),27000);
});
test('final audit reconciles every posted ledger entry to booking, projection, refund counters and monthly caches',async()=>{
  const entries=(await root.collection('transactions').get()).docs.map(s=>s.data()),bookings=new Map(),refunds=new Map(),months=new Map();
  for(const e of entries){
    if(e.bookingId){const sums=bookings.get(e.bookingId)??{received:0,refunded:0};sums[e.kind==='refund'?'refunded':'received']+=e.amount;bookings.set(e.bookingId,sums);}
    if(e.kind==='refund')refunds.set(e.originalEntryId,(refunds.get(e.originalEntryId)??0)+e.amount);
    for(const method of ['all',e.method]){const key=`${e.effectiveDate.slice(0,7)}_${method}`,sums=months.get(key)??{income:0,refund:0,expense:0,count:0};sums[['income_dp','income_settlement'].includes(e.kind)?'income':e.kind]+=e.amount;sums.count++;months.set(key,sums);}
  }
  for(const [id,sums]of bookings){const b=(await root.collection('bookings').doc(id).get()).data(),account=(await root.collection('financeAccounts').doc(id).get()).data(),projection=(await root.collection('sessions').doc(id).get()).data();assert.equal(b.paidAmount,sums.received);assert.equal(b.refundedAmount,sums.refunded);assert.equal(account.received,sums.received);assert.equal(account.refunded,sums.refunded);assert.equal(b.netPaidAmount,sums.received-sums.refunded);assert.equal(projection.version,b.version);assert.equal(projection.paymentStatus,b.paymentStatus);}
  for(const [id,sum]of refunds){assert.equal((await root.collection('refundBalances').doc(id).get()).data().amount,sum);assert.ok(sum<=(await root.collection('transactions').doc(id).get()).data().amount);}
  for(const [id,sums]of months){const cache=(await root.collection('financeMonths').doc(id).get()).data();for(const field of ['income','refund','expense','count'])assert.equal(cache[field],sums[field]);}
});

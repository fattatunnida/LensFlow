import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getFirebaseClient} from '../../src/lib/firebase/client.ts';
import {saveMaster} from '../../src/features/master-data/repository.ts';
import {validateClient,validatePackage} from '../../src/features/master-data/validation.ts';
import * as booking from '../../src/features/spark/bookings.ts';
import * as finance from '../../src/features/spark/finance.ts';
import * as management from '../../src/features/spark/management.ts';
import * as overview from '../../src/features/spark/overview.ts';
import {moneyData,sessionData,searchTokens,dayMs} from '../../src/features/spark/core.ts';
const {doc,getDocFromServer,updateDoc,setDoc,writeBatch,serverTimestamp,Timestamp}=createRequire(import.meta.url)('firebase/firestore');
const require=createRequire(import.meta.url),{signInWithEmailAndPassword}=require('firebase/auth'),{getApp,deleteApp:deleteSdk}=require('firebase/app');
for(const host of [process.env.FIREBASE_AUTH_EMULATOR_HOST,process.env.FIRESTORE_EMULATOR_HOST])if(!host||!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw new Error('Loopback emulators required.');
globalThis.__DEV__=true;Object.assign(process.env,{EXPO_PUBLIC_FIREBASE_USE_EMULATORS:'true',EXPO_PUBLIC_FIREBASE_EMULATOR_HOST:'127.0.0.1',EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT:'9099',EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT:'8082'});
const admin=initializeApp({projectId:'demo-lensflow'},'spark-test'),db=getFirestore(admin),auth=getAuth(admin),studioId='spark-operations',uid='spark-owner',root=db.doc(`studios/${studioId}`),day=n=>new Date(Date.now()+n*86400000+7*3600000).toISOString().slice(0,10);let client;
const make=(id,date=day(3),startTime='09:00',endTime='10:00')=>booking.command({studioId,bookingId:id,mutationId:`create-${id}-0000001`,action:'create',expectedVersion:null,clientId:'customer',packageId:'package',clientVersion:1,packageVersion:1,dpPercent:30,date,startTime,endTime,location:'Studio',notes:''});
const pay=(id,kind,version,amount,patch={})=>finance.command({studioId,entryId:id,mutationId:`money-${id}-0000001`,kind,bookingId:'first',expectedVersion:version,amount,method:'transfer',effectiveDate:day(0),description:kind==='refund'?'Refund verified':'',acknowledged:true,...patch});
before(async()=>{
  await db.recursiveDelete(root);try{await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid,email:'spark-owner@lensflow.test',password:'SparkOwner2026!'});}
  await root.set({name:'Spark test',timezone:'Asia/Jakarta',clientBackendVersion:1});await db.doc(`users/${uid}`).set({studioId,email:'spark-owner@lensflow.test',displayName:'Spark Owner'});await root.collection('members').doc(uid).set({role:'owner',status:'active',permissions:{booking:true,calendarCrm:true,payments:true,reports:true}});
  client=getFirebaseClient();await signInWithEmailAndPassword(client.auth,'spark-owner@lensflow.test','SparkOwner2026!');const actor={uid,studioId,role:'owner',crm:true,booking:true,payments:true,reports:true};
  await saveMaster(client.db,actor,'clients','customer',null,validateClient({name:'Spark Customer',phone:'081234567890',email:'',address:'Secret',notes:'Secret',leadSource:''}).value,'spark-client-00001');await saveMaster(client.db,actor,'packages','package',null,validatePackage({name:'Spark Portrait',price:'500000',durationMinutes:'60',editedPhotosCount:'10',defaultLocation:'Studio',description:'',isActive:true}).value,'spark-package-0001');
});
after(async()=>{await deleteSdk(getApp());await deleteApp(admin);});
test('direct Firestore booking creates atomic lock/context/projection/receipt and exact retry is stable',async()=>{
  const first=await make('first');assert.equal(first.version,1);assert.deepEqual(await make('first'),first);const lock=(await root.collection('scheduleLocks').doc(day(3)).get()).data();assert.deepEqual(lock.order,['first']);assert.equal((await root.collection('sessions').doc('first').get()).get('version'),1);assert.equal((await root.collection('financeContexts').doc('first').get()).get('remaining'),500000);
});
test('overlap and concurrent create are checked against the same ordered day lock',async()=>{
  await assert.rejects(make('overlap',day(3),'09:30','10:30'),e=>e.details?.reason==='schedule-conflict');const results=await Promise.allSettled([make('race-a',day(4)),make('race-b',day(4))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('direct DP, settlement, cancel/refund and expense keep immutable ledger, versions and head sequence',async()=>{
  await pay('dp','income_dp',1,150000);await pay('settle','income_settlement',2,350000);assert.equal((await root.collection('bookings').doc('first').get()).get('paymentStatus'),'paid');
  await booking.command({studioId,bookingId:'first',mutationId:'cancel-first-00001',action:'cancel',expectedVersion:3,reason:'Customer cancellation'});await pay('refund','refund',4,50000,{originalEntryId:'dp'});assert.equal((await root.collection('refundBalances').doc('dp').get()).get('amount'),50000);
  await finance.command({studioId,entryId:'expense',mutationId:'expense-first-00001',kind:'expense',amount:50000,category:'utilitas',method:'qris',effectiveDate:day(0),description:'Studio utility',acknowledged:true});
  assert.equal((await root.collection('financeCounters').doc('main').get()).get('count'),4);assert.equal((await root.collection('financeContexts').doc('first').get()).get('refundStatus'),'partial');assert.deepEqual((await root.collection('scheduleLocks').doc(day(3)).get()).get('order'),[]);
});

test('same-day and cross-day reschedule maintain sorted adjacent locks and reject stale versions',async()=>{
  await make('moving',day(5));await make('adjacent',day(5),'10:00','11:00');
  await booking.command({studioId,bookingId:'moving',mutationId:'move-sameday-0001',action:'reschedule',expectedVersion:1,date:day(5),startTime:'11:00',endTime:'12:00',location:'Studio',reason:'Customer request'});
  assert.deepEqual((await root.collection('scheduleLocks').doc(day(5)).get()).get('order'),['adjacent','moving']);
  await booking.command({studioId,bookingId:'moving',mutationId:'move-crossday-0001',action:'reschedule',expectedVersion:2,date:day(6),startTime:'09:00',endTime:'10:00',location:'Studio',reason:'Customer request'});
  assert.deepEqual((await root.collection('scheduleLocks').doc(day(5)).get()).get('order'),['adjacent']);assert.deepEqual((await root.collection('scheduleLocks').doc(day(6)).get()).get('order'),['moving']);
  await assert.rejects(booking.command({studioId,bookingId:'moving',mutationId:'move-stale-000001',action:'cancel',expectedVersion:2,reason:'Stale update'}),e=>e.details?.reason==='version-conflict');
});

test('raw clients cannot alter ledger, balances, package snapshot, projections, locks or roles independently',async()=>{
  const denied=e=>e.code==='permission-denied';
  for(const [path,patch]of [['transactions/dp',{amount:1}],['bookings/moving',{total:1}],['financeContexts/moving',{remaining:1}],['sessions/moving',{version:99}],['scheduleLocks/'+day(6),{order:[]}],['members/'+uid,{role:'staff'}]]){
    await assert.rejects(updateDoc(doc(client.db,`studios/${studioId}/${path}`),patch),denied,path);
  }
  await assert.rejects(setDoc(doc(client.db,`studios/${studioId}/transactions/forged`),{kind:'income_settlement',amount:1}),denied);
  const batch=writeBatch(client.db);batch.update(doc(client.db,`studios/${studioId}/bookings/moving`),{total:1,version:4,updatedAt:serverTimestamp()});batch.update(doc(client.db,`studios/${studioId}/financeContexts/moving`),{total:1,remaining:1,version:4,updatedAt:serverTimestamp()});await assert.rejects(batch.commit(),denied);
});

test('coherent forged booking batch cannot change authoritative package price or bypass occupied locks',async()=>{
  const source=(await getDocFromServer(doc(client.db,`studios/${studioId}/bookings/adjacent`))).data();
  for(const attack of ['price','overlap']){
    const id=`forged-${attack}`,date=attack==='overlap'?day(5):day(10),number=(await root.collection('bookingCounters').doc('main').get()).get('value')+1,mutationId=`forged-${attack}-00001`,time=serverTimestamp();
    const b={...source,bookingId:id,code:`BK-${String(number).padStart(6,'0')}`,date,startTime:'10:00',endTime:'11:00',startAt:Timestamp.fromMillis(dayMs(date)+10*3600000),endAt:Timestamp.fromMillis(dayMs(date)+11*3600000),version:1,writeAction:'create',mutationId,writeReason:'',createdAt:time,updatedAt:time};
    if(attack==='price'){b.total=100;b.dpTarget=30;b.packageSnapshot={...b.packageSnapshot,price:100};}b.searchTokens=searchTokens(b.clientName,b.packageName,b.code,date);
    const old=(await getDocFromServer(doc(client.db,`studios/${studioId}/scheduleLocks/${date}`))).data()??{entries:{},order:[],revision:0},batch=writeBatch(client.db),r=path=>doc(client.db,`studios/${studioId}/${path}`);
    batch.set(r(`bookings/${id}`),b);batch.set(r(`sessions/${id}`),sessionData(b,id));batch.set(r(`financeContexts/${id}`),moneyData(b,id));
    batch.set(r(`bookingCounters/main`),{value:number,lastBookingId:id,updatedAt:time});batch.set(r(`scheduleLocks/${date}`),{...old,entries:{...old.entries,[id]:{startMs:b.startAt.toMillis(),endMs:b.endAt.toMillis()}},order:[...old.order,id],index:old.order.length,revision:old.revision+1,changedBooking:id,lastMutation:mutationId,updatedBy:uid,updatedAt:time});
    batch.set(r(`bookingMutations/${uid}_${mutationId}`),{fingerprint:'forged',result:{id,version:1,code:b.code},uid,bookingId:id,mutationId,action:'create',actorId:uid,reason:'',version:1,date,startTime:b.startTime,endTime:b.endTime,sessionStatus:'confirmed',createdAt:time});await assert.rejects(batch.commit(),e=>e.code==='permission-denied',attack);
  }
});

test('concurrent settlement admits one writer and idempotent retry never increments ledger twice',async()=>{
  await make('money-race',day(11));const payload=id=>({studioId,entryId:id,mutationId:`race-money-${id}-0001`,kind:'income_settlement',bookingId:'money-race',expectedVersion:1,amount:500000,method:'transfer',effectiveDate:day(0),description:'',acknowledged:true});
  const before=(await root.collection('financeCounters').doc('main').get()).get('count'),results=await Promise.allSettled(['a','b'].map(id=>finance.command(payload(id))));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const winner=results[0].status==='fulfilled'?'a':'b';await finance.command(payload(winner));assert.equal((await root.collection('financeCounters').doc('main').get()).get('count'),before+1);
});

test('reports reconcile immutable sequence; preferences and first-read markers persist',async()=>{
  const report=await overview.report({studioId,from:day(0),to:day(0)});assert.equal(report.income,1000000);assert.equal(report.refund,50000);assert.equal(report.expense,50000);assert.equal(report.cashNet,900000);
  const prefs=await overview.preferences({studioId});assert.equal(prefs.version,0);await overview.preferences({studioId,expectedVersion:0,value:{schedule:true,payments:true,reminders:true}});
  const inbox=await overview.inbox({studioId}),payment=inbox.items.find(i=>i.id==='payment_dp');assert.ok(payment);await overview.mark({studioId,id:payment.id});const first=(await root.collection('inboxReads').doc(uid).collection('items').doc(payment.id).get()).get('readAt');await overview.mark({studioId,id:payment.id});assert.equal((await root.collection('inboxReads').doc(uid).collection('items').doc(payment.id).get()).get('readAt').toMillis(),first.toMillis());
  await overview.preferences({studioId,expectedVersion:1,value:{schedule:true,payments:false,reminders:true}});assert.ok(!(await overview.inbox({studioId})).items.some(i=>i.kind==='payment'));
});

test('studio/profile edits are versioned; owner role and backend gate are immutable',async()=>{
  await management.studio({studioId,expectedVersion:0,value:{name:'Spark Updated',address:'Studio address',phone:'08123456789',openingTime:'08:00',closingTime:'21:00',defaultDpPercent:30}});
  await management.profile({studioId,expectedVersion:0,value:{displayName:'Spark Owner Updated',phone:'08123456789',jobTitle:'Owner'}});assert.equal((await root.collection('members').doc(uid).get()).get('displayName'),'Spark Owner Updated');
  await assert.rejects(updateDoc(doc(client.db,`studios/${studioId}`),{clientBackendVersion:2}),e=>e.code==='permission-denied');
});

test('verified invitation claim grants only invited permissions; owner can revoke immediately',async()=>{
  const address='spark-staff@lensflow.test',permissions={booking:false,calendarCrm:false,payments:true,reports:false};
  try{const old=await auth.getUserByEmail(address);await auth.deleteUser(old.uid);await db.doc(`users/${old.uid}`).delete();}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  await management.staffCommand({studioId,action:'invite',email:address,displayName:'Spark Staff',permissions,mutationId:'invite-spark-00001'});const staff=await auth.createUser({email:address,password:'SparkStaff2026!'});
  await signInWithEmailAndPassword(client.auth,address,'SparkStaff2026!');await assert.rejects(management.claimInvitation(client.db,client.auth.currentUser,studioId,address,'Spark Staff'),e=>e.code==='app/failed-precondition');
  await auth.updateUser(staff.uid,{emailVerified:true});await management.claimInvitation(client.db,client.auth.currentUser,studioId,address,'Spark Staff');await management.claimInvitation(client.db,client.auth.currentUser,studioId,address,'Spark Staff');
  assert.deepEqual((await root.collection('members').doc(staff.uid).get()).get('permissions'),permissions);
  await assert.rejects(getDocFromServer(doc(client.db,`studios/${studioId}/bookings/moving`)),e=>e.code==='permission-denied');await assert.rejects(getDocFromServer(doc(client.db,`studios/${studioId}/clients/customer`)),e=>e.code==='permission-denied');
  await finance.command({studioId,entryId:'staff-dp',mutationId:'staff-payment-0001',kind:'income_dp',bookingId:'moving',expectedVersion:3,amount:100000,method:'transfer',effectiveDate:day(0),description:'',acknowledged:true});
  await assert.rejects(overview.report({studioId,from:day(0),to:day(0)}),e=>e.code==='app/permission-denied');
  await assert.rejects(updateDoc(doc(client.db,`studios/${studioId}/members/${staff.uid}`),{role:'owner'}),e=>e.code==='permission-denied');
  await signInWithEmailAndPassword(client.auth,'spark-owner@lensflow.test','SparkOwner2026!');await management.staffCommand({studioId,action:'update',uid:staff.uid,expectedVersion:1,status:'inactive',permissions});
  await signInWithEmailAndPassword(client.auth,address,'SparkStaff2026!');await assert.rejects(getDocFromServer(doc(client.db,`studios/${studioId}/financeContexts/moving`)),e=>e.code==='permission-denied');await signInWithEmailAndPassword(client.auth,'spark-owner@lensflow.test','SparkOwner2026!');
});

test('concurrent refunds never exceed the original payment and exact replay remains stable',async()=>{
  const results=await Promise.allSettled([pay('refund-race-a','refund',5,75000,{originalEntryId:'dp'}),pay('refund-race-b','refund',5,75000,{originalEntryId:'dp'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const winner=results[0].status==='fulfilled'?'refund-race-a':'refund-race-b';await pay(winner,'refund',5,75000,{originalEntryId:'dp'});assert.equal((await root.collection('refundBalances').doc('dp').get()).get('amount'),125000);
  await assert.rejects(pay('refund-excess','refund',6,75000,{originalEntryId:'dp'}),e=>e.code==='app/invalid-argument');
});

test('report-only role can reconcile cash but cannot post money, open CRM or read another studio',async()=>{
  const userId='spark-reporter',address='spark-reporter@lensflow.test';try{await auth.getUser(userId);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid:userId,email:address,password:'SparkReporter2026!'});}
  await db.doc(`users/${userId}`).set({studioId,email:address,displayName:'Reporter'});await root.collection('members').doc(userId).set({role:'staff',status:'active',permissions:{booking:false,calendarCrm:false,payments:false,reports:true}});
  await signInWithEmailAndPassword(client.auth,address,'SparkReporter2026!');try{
    assert.equal((await overview.report({studioId,from:day(0),to:day(0)})).income,1100000);
    await assert.rejects(finance.command({studioId,entryId:'report-forged',mutationId:'report-forged-0001',kind:'expense',amount:100,method:'qris',category:'utilitas',effectiveDate:day(0),description:'Forged report expense',acknowledged:true}),e=>e.code==='app/permission-denied');
    for(const path of [`studios/${studioId}/clients/customer`,'studios/another-studio'])await assert.rejects(getDocFromServer(doc(client.db,path)),e=>e.code==='permission-denied');
    await assert.rejects(setDoc(doc(client.db,`studios/${studioId}/transactions/forged-report`),{kind:'expense',amount:100}),e=>e.code==='permission-denied');
  }finally{await signInWithEmailAndPassword(client.auth,'spark-owner@lensflow.test','SparkOwner2026!');}
});

test('expired and cancelled invitations grant no membership; accepted invitations cannot be issued again',async()=>{
  const permissions={booking:true,calendarCrm:false,payments:false,reports:false},address='spark-expired@lensflow.test';try{const old=await auth.getUserByEmail(address);await auth.deleteUser(old.uid);await db.doc(`users/${old.uid}`).delete();}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  await management.staffCommand({studioId,action:'invite',email:address,displayName:'Expired Staff',permissions,mutationId:'invite-expired-0001'});await root.collection('invitations').doc(address).update({expiresAt:new Date(Date.now()-1000)});await auth.createUser({email:address,password:'SparkExpired2026!',emailVerified:true});
  await signInWithEmailAndPassword(client.auth,address,'SparkExpired2026!');try{await assert.rejects(management.claimInvitation(client.db,client.auth.currentUser,studioId,address,'Expired Staff'),e=>e.code==='app/failed-precondition');}finally{await signInWithEmailAndPassword(client.auth,'spark-owner@lensflow.test','SparkOwner2026!');}
  await management.staffCommand({studioId,action:'inviteLink',uid:`invite:${address}`});await management.staffCommand({studioId,action:'update',uid:`invite:${address}`,expectedVersion:2,status:'inactive',permissions});
  await signInWithEmailAndPassword(client.auth,address,'SparkExpired2026!');try{await assert.rejects(management.claimInvitation(client.db,client.auth.currentUser,studioId,address,'Expired Staff'),e=>e.code==='app/failed-precondition');}finally{await signInWithEmailAndPassword(client.auth,'spark-owner@lensflow.test','SparkOwner2026!');}
  await assert.rejects(management.staffCommand({studioId,action:'inviteLink',uid:'invite:spark-staff@lensflow.test'}),e=>e.code==='app/failed-precondition');
});

test('complete raw financial batches enforce settlement amount, method and refund source cap',async()=>{
  async function commit(id,bookingId,amount,kind,method='transfer'){
    const r=path=>doc(client.db,`studios/${studioId}/${path}`),snapshot=await getDocFromServer(r(`bookings/${bookingId}`)),old=snapshot.data(),template=(await getDocFromServer(r(`transactions/${kind==='refund'?'refund':'staff-dp'}`))).data(),head=(await getDocFromServer(r('financeCounters/main'))).data(),time=serverTimestamp(),mutationId=`raw-finance-${id}-0001`,isRefund=kind==='refund';
    const paid=old.paidAmount+(isRefund?0:amount),refunded=old.refundedAmount+(isRefund?amount:0),description=isRefund?'Verified refund source':'',b={...old,paidAmount:paid,refundedAmount:refunded,netPaidAmount:paid-refunded,paymentStatus:paid-refunded===old.total?'paid':paid?'dp_paid':'pending_dp',refundStatus:refunded===0?'none':refunded===paid?'full':'partial',version:old.version+1,updatedBy:uid,updatedAt:time,writeAction:kind,mutationId,writeReason:description,lastEntryId:id};
    const entry={...template,id,studioId,kind,amount,method,description,category:'',bookingId,bookingCode:old.code,clientName:old.clientName,originalEntryId:isRefund?'dp':'',createdAt:time,createdBy:uid,createdByName:'Spark Owner Updated',mutationId,acknowledgedBy:uid,sequence:head.count+1,expectedVersion:old.version,bookingDate:old.date,bookingStartTime:old.startTime,bookingEndTime:old.endTime,sessionStatus:old.sessionStatus};
    const batch=writeBatch(client.db);batch.set(snapshot.ref,b);batch.set(r(`sessions/${bookingId}`),sessionData(b,bookingId));batch.set(r(`financeContexts/${bookingId}`),moneyData(b,bookingId));batch.set(r(`transactions/${id}`),entry);batch.set(r('financeCounters/main'),{count:entry.sequence,lastEntryId:id,updatedAt:time});batch.set(r(`financeMutations/${uid}_${mutationId}`),{hash:'raw-test',result:{entryId:id,bookingId,bookingVersion:b.version},uid,mutationId,entryId:id,createdAt:time});
    if(isRefund){const source=(await getDocFromServer(r('refundBalances/dp'))).data();batch.set(r('refundBalances/dp'),{amount:source.amount+amount,version:source.version+1,lastEntryId:id,updatedAt:time});}await batch.commit();
  }
  const denied=e=>e.code==='permission-denied';await assert.rejects(commit('wrong-settlement','moving',1,'income_settlement'),denied);await assert.rejects(commit('wrong-method','moving',400000,'income_settlement','cash'),denied);await commit('raw-settlement-valid','moving',400000,'income_settlement');
  await assert.rejects(commit('excess-source-refund','first',50000,'refund'),denied);await commit('raw-refund-valid','first',25000,'refund');assert.equal((await root.collection('refundBalances').doc('dp').get()).get('amount'),150000);
});

import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { initializeApp as adminInit, deleteApp as adminDelete } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore, Timestamp } from 'firebase-admin/firestore';
const require=createRequire(import.meta.url);
const { initializeApp,deleteApp }=require('firebase/app');
const { getAuth,connectAuthEmulator,signInWithEmailAndPassword }=require('firebase/auth');
const { getFunctions,connectFunctionsEmulator,httpsCallable }=require('firebase/functions');
const { getFirestore,connectFirestoreEmulator,doc,getDocFromServer,setDoc,deleteDoc,collection,getDocs,query,where,orderBy,limit,startAfter }=require('firebase/firestore');
for(const host of [process.env.FIREBASE_AUTH_EMULATOR_HOST,process.env.FIRESTORE_EMULATOR_HOST])if(!host||!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw new Error('Booking tests require loopback emulators.');
const app=adminInit({projectId:'demo-lensflow'},'booking-tests'),db=adminFirestore(app),auth=adminAuth(app),apps=[],clients={};
const studioId='booking-test-a',root=db.doc(`studios/${studioId}`);
const future=(offset=4)=>new Date(Date.now()+offset*86400000+7*3600000).toISOString().slice(0,10);
const denied=error=>['permission-denied','functions/permission-denied'].includes(error.code);
const reason=value=>error=>error.details?.reason===value;
const call=(role,name,data)=>httpsCallable(clients[role].functions,name,{timeout:45000})(data).then(r=>r.data);
const cmd=(id,patch={},role='owner')=>call(role,'bookingCommand',{action:'create',studioId,bookingId:id,mutationId:`mutation-${id}-0001`,expectedVersion:null,clientId:'client-main',packageId:'package-main',clientVersion:1,packageVersion:1,dpPercent:30,date:future(),startTime:'09:00',endTime:'10:00',location:'Studio A',notes:'Catatan awal',...patch});
const change=(id,action,expectedVersion,patch={},role='owner')=>call(role,'bookingCommand',{studioId,bookingId:id,mutationId:`mutation-${id}-${action}-${expectedVersion}`,action,expectedVersion,...patch});
before(async()=>{
  for(const name of ['booking-test-a','booking-test-b'])await db.recursiveDelete(db.doc(`studios/${name}`));
  for(const [role,permissions]of Object.entries({owner:{booking:true,calendarCrm:true},booking:{booking:true,calendarCrm:false},crm:{booking:false,calendarCrm:true},none:{booking:false,calendarCrm:false},inactive:{booking:true,calendarCrm:true},other:{booking:true,calendarCrm:true}})){
    const uid=`b4-${role}`,studio=role==='other'?'booking-test-b':studioId;
    try{await auth.getUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;await auth.createUser({uid,email:`${uid}@lensflow.test`,password:'BookingTests2026!'});}
    await db.doc(`users/${uid}`).set({studioId:studio,displayName:uid,email:`${uid}@lensflow.test`});
    await db.doc(`studios/${studio}`).set({name:studio,timezone:'Asia/Jakarta',openingTime:'08:00',closingTime:'21:00',defaultDpPercent:30});
    await db.doc(`studios/${studio}/members/${uid}`).set({role:role==='owner'?'owner':'staff',status:role==='inactive'?'inactive':'active',permissions:{...permissions,payments:false,reports:false}});
    const sdk=initializeApp({projectId:'demo-lensflow',apiKey:'demo-key'},`booking-${role}`);apps.push(sdk);
    const clientAuth=getAuth(sdk);connectAuthEmulator(clientAuth,`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,{disableWarnings:true});
    const firestore=getFirestore(sdk),[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');connectFirestoreEmulator(firestore,host,Number(port));
    const functions=getFunctions(sdk,'asia-southeast2');connectFunctionsEmulator(functions,'127.0.0.1',5001);
    await signInWithEmailAndPassword(clientAuth,`${uid}@lensflow.test`,'BookingTests2026!');clients[role]={functions,db:firestore};
  }
  await root.collection('clients').doc('client-main').set({name:'Rina Asli',nameKey:'rina asli',phone:'+6281234567890',email:'rina@example.test',version:1,notes:'Private CRM notes',address:'Private address'});
  await root.collection('packages').doc('package-main').set({name:'Portrait Asli',nameKey:'portrait asli',price:500005,durationMinutes:60,editedPhotosCount:10,defaultLocation:'Studio A',description:'Portrait',isActive:true,version:1});
});
after(async()=>{await Promise.all(apps.map(deleteApp));await adminDelete(app);});

test('callable creates authoritative snapshots, half-up DP, projection and audit atomically',async()=>{
  const result=await cmd('primary');assert.match(result.code,/^BK-\d{6}$/);assert.equal(result.version,1);
  const b=(await root.collection('bookings').doc('primary').get()).data(),s=(await root.collection('sessions').doc('primary').get()).data();
  assert.equal(b.clientName,'Rina Asli');assert.equal(b.total,500005);assert.equal(b.dpTarget,150002);assert.equal(b.paidAmount,0);assert.equal(b.sessionStatus,'confirmed');assert.equal(b.paymentStatus,'pending_dp');assert.equal(b.createdBy,'b4-owner');assert.ok(b.createdAt instanceof Timestamp);
  for(const key of ['total','paidAmount','clientPhone','clientEmail','notes','packageSnapshot'])assert.equal(key in s,false);
  assert.equal(s.code,b.code);assert.ok(s.searchTokens.includes('portrait'));assert.equal((await root.collection('bookings').doc('primary').collection('events').get()).size,1);
});
test('lost-response retry returns the same receipt and changed payload cannot reuse its key',async()=>{
  const result=await cmd('primary');assert.equal(result.version,1);
  assert.equal((await root.collection('bookingCounters').doc('main').get()).data().value,1);
  await assert.rejects(cmd('primary',{notes:'Different payload'}),reason('mutation-conflict'));
  await root.collection('packages').doc('package-main').update({name:'Changed catalog',price:900000,version:2});
  assert.equal((await cmd('primary')).version,1);
  const b=(await root.collection('bookings').doc('primary').get()).data();assert.equal(b.total,500005);assert.equal(b.packageSnapshot.name,'Portrait Asli');
  await root.collection('packages').doc('package-main').update({name:'Portrait Asli',price:500005,version:1});
});
test('two concurrent requests for an initially empty day admit one writer; adjacent intervals remain valid',async()=>{
  const date=future(5),results=await Promise.allSettled([cmd('race-one',{date,startTime:'10:00',endTime:'11:00'}),cmd('race-two',{date,startTime:'10:30',endTime:'11:30'},'booking')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&reason('schedule-conflict')(r.reason)).length,1);
  const accepted=results[0].status==='fulfilled'?'race-one':'race-two',b=(await root.collection('bookings').doc(accepted).get()).data();
  await cmd('adjacent',{date,startTime:b.endTime,endTime:b.endTime==='11:00'?'12:00':'12:30'});
  const slots=(await root.collection('scheduleDays').doc(date).get()).data().slots;assert.equal(slots.length,2);
  const [a,c]=slots.sort((a,c)=>a.startMs-c.startMs);assert.ok(a.endMs<=c.startMs);
});
test('reschedule excludes itself, is atomic on conflict, frees the old day and rejects stale versions',async()=>{
  const date=future(6);await cmd('moving',{date});
  await change('moving','reschedule',1,{date,startTime:'09:15',endTime:'10:15',location:'Outdoor',reason:'Permintaan pelanggan'});
  await cmd('blocked',{date,startTime:'12:00',endTime:'13:00'});
  await assert.rejects(change('moving','reschedule',2,{date,startTime:'12:15',endTime:'13:15',location:'Outdoor',reason:'Jadwal bentrok'}),reason('schedule-conflict'));
  assert.equal((await root.collection('bookings').doc('moving').get()).data().startTime,'09:15');
  await change('moving','reschedule',2,{date:future(7),startTime:'14:00',endTime:'15:00',location:'Studio',reason:'Tanggal baru'});
  await cmd('reuse-old',{date,startTime:'09:00',endTime:'10:00'});
  await assert.rejects(change('moving','edit',1,{location:'Wrong',notes:'Stale'}),reason('version-conflict'));
  assert.equal((await root.collection('bookings').doc('moving').get()).data().version,3);
});
test('concurrent reschedules into a new day admit only one booking and preserve the losing schedule',async()=>{
  await cmd('race-moving-one',{date:future(11)});await cmd('race-moving-two',{date:future(12)});
  const patch={date:future(13),startTime:'10:00',endTime:'11:00',location:'Studio',reason:'Concurrent move'};
  const results=await Promise.allSettled([change('race-moving-one','reschedule',1,patch),change('race-moving-two','reschedule',1,patch,'booking')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&reason('schedule-conflict')(r.reason)).length,1);
  const loserIndex=results[0].status==='rejected'?0:1,loser=loserIndex===0?'race-moving-one':'race-moving-two';
  const b=(await root.collection('bookings').doc(loser).get()).data();assert.equal(b.version,1);assert.equal(b.date,future(loserIndex===0?11:12));
  assert.equal((await root.collection('scheduleDays').doc(future(13)).get()).data().slots.length,1);
});
test('cancellation releases slots, preserves payment data and does not create refund transactions',async()=>{
  const date=future(8);await cmd('cancelled',{date});
  await root.collection('bookings').doc('cancelled').update({paidAmount:100000,paymentStatus:'dp_paid'});
  const result=await change('cancelled','cancel',1,{reason:'Pelanggan berhalangan'});
  assert.deepEqual(await change('cancelled','cancel',1,{reason:'Pelanggan berhalangan'}),result);
  const b=(await root.collection('bookings').doc('cancelled').get()).data();assert.equal(b.sessionStatus,'cancelled');assert.equal(b.paidAmount,100000);
  assert.equal((await root.collection('transactions').get()).size,0);
  await cmd('cancel-reuse',{date});
  await assert.rejects(change('cancelled','reschedule',2,{date,startTime:'10:00',endTime:'11:00',location:'Studio',reason:'No reopening'}),reason('terminal'));
});
test('completion cannot precede session start; done remains separate from payment and is terminal',async()=>{
  const date=future(9);await cmd('complete',{date});
  await assert.rejects(change('complete','complete',1),e=>e.code==='functions/failed-precondition');
  // Test-only clock fixture: keep the reservation and schedule projection coherent.
  const startAt=Timestamp.fromMillis(Date.now()-3600000),endAt=Timestamp.fromMillis(Date.now()-1800000);
  await root.collection('bookings').doc('complete').update({startAt,endAt});
  await root.collection('scheduleDays').doc(date).set({slots:[{id:'complete',startMs:startAt.toMillis(),endMs:endAt.toMillis()}],revision:1});
  await change('complete','complete',1);
  const b=(await root.collection('bookings').doc('complete').get()).data();assert.equal(b.sessionStatus,'done');assert.equal(b.paymentStatus,'pending_dp');assert.equal(b.paidAmount,0);
  await assert.rejects(change('complete','cancel',2,{reason:'Cannot undo done'}),reason('terminal'));
});
test('authorization and Rules reject cross-studio, inactive, unauthorized and direct schedule writes',async()=>{
  for(const role of ['crm','none','inactive','other'])await assert.rejects(cmd(`deny-${role}`,{date:future(10)},role),denied);
  await root.collection('members').doc('b4-none').update({'permissions.booking':'true'});
  try{await assert.rejects(cmd('deny-malformed',{date:future(10)},'none'),denied);}finally{await root.collection('members').doc('b4-none').update({'permissions.booking':false});}
  const owner=clients.owner.db,crm=clients.crm.db;
  for(const path of ['bookings/forged','sessions/forged','scheduleDays/forged','bookingCounters/main','bookingMutations/forged','bookings/primary/events/forged'])await assert.rejects(setDoc(doc(owner,`studios/${studioId}/${path}`),{total:1}),denied);
  await assert.rejects(deleteDoc(doc(owner,`studios/${studioId}/bookings/primary`)),denied);
  assert.equal((await getDocFromServer(doc(crm,`studios/${studioId}/sessions/primary`))).data().clientName,'Rina Asli');
  await assert.rejects(getDocFromServer(doc(crm,`studios/${studioId}/bookings/primary`)),denied);
  await assert.rejects(getDocFromServer(doc(clients.other.db,`studios/${studioId}/sessions/primary`)),denied);
  const anonymous=initializeApp({projectId:'demo-lensflow',apiKey:'demo-key'},'booking-anonymous');apps.push(anonymous);const functions=getFunctions(anonymous,'asia-southeast2');connectFunctionsEmulator(functions,'127.0.0.1',5001);
  await assert.rejects(httpsCallable(functions,'bookingCommand')({studioId,bookingId:'anon',mutationId:'anonymous-00001',action:'complete',expectedVersion:1}),e=>e.code==='functions/unauthenticated');
});
test('server validates current package, dates, hours, granularity and refuses client supplied prices',async()=>{
  for(const patch of [{total:1},{date:'2026-02-30'},{date:future(-1)},{startTime:'07:00',endTime:'08:00'},{startTime:'09:01'},{endTime:'08:00'},{notes:'x'.repeat(2001)}])await assert.rejects(cmd('bad-input',{date:future(10),...patch}),e=>e.code==='functions/invalid-argument');
  await assert.rejects(cmd('stale-package',{packageVersion:2,date:future(10)}),reason('selection-stale'));
  await assert.rejects(cmd('cross-package',{packageId:'missing-other-studio',date:future(10)}),reason('selection-stale'));
  await root.collection('packages').doc('package-main').update({isActive:false});
  await assert.rejects(cmd('inactive-package',{date:future(10)}),reason('selection-stale'));
  await root.collection('packages').doc('package-main').update({isActive:true});
});
test('server honors studio opening hours and DP settings rather than client defaults',async()=>{
  await root.update({openingTime:'07:00',closingTime:'22:00',defaultDpPercent:40});
  try{
    await assert.rejects(cmd('stale-studio',{date:future(14),startTime:'07:00',endTime:'08:00'}),reason('selection-stale'));
    await cmd('custom-studio',{date:future(14),startTime:'07:00',endTime:'08:00',dpPercent:40});
    const b=(await root.collection('bookings').doc('custom-studio').get()).data();assert.equal(b.dpTarget,200002);assert.equal(b.dpPercent,40);
  }finally{await root.update({openingTime:'08:00',closingTime:'21:00',defaultDpPercent:30});}
});
test('booking pickers are paged, normalized, minimal and restricted to booking operators',async()=>{
  for(let i=0;i<27;i++)await root.collection('clients').doc(`pick-${i}`).set({name:`Picker ${String(i).padStart(2,'0')}`,nameKey:`picker ${String(i).padStart(2,'0')}`,phone:`+6281111122${String(i).padStart(2,'0')}`,email:'',version:1,notes:'Secret',address:'Secret'});
  const data={studioId,kind:'clients',search:'PICKER'};
  const first=await call('booking','bookingChoices',data),second=await call('booking','bookingChoices',{...data,next:first.next});
  assert.equal(first.items.length,25);assert.equal(second.items.length,2);assert.equal(second.next,null);assert.equal('notes'in first.items[0],false);assert.equal('address'in first.items[0],false);
  const phone=await call('booking','bookingChoices',{studioId,kind:'clients',search:'08111112200'});assert.equal(phone.items[0].id,'pick-0');
  await assert.rejects(call('crm','bookingChoices',data),denied);
  const slots=await call('booking','bookingAvailability',{studioId,date:future(),startTime:'09:15',endTime:'09:45'});assert.equal(slots.available,false);
});
test('server search/filter pagination and event versions remain consistent with saved sessions',async()=>{
  const sdk=clients.owner.db,base=collection(sdk,`studios/${studioId}/sessions`);
  const search=await getDocs(query(base,where('searchTokens','array-contains','portrait'),where('stateKey','==','pending_dp'),orderBy('startAt','desc'),limit(2)));
  assert.equal(search.size,2);const page2=await getDocs(query(base,where('searchTokens','array-contains','portrait'),where('stateKey','==','pending_dp'),orderBy('startAt','desc'),startAfter(search.docs.at(-1)),limit(2)));
  assert.ok(page2.docs.every(d=>!search.docs.some(p=>p.id===d.id)));
  const events=await root.collection('bookings').doc('moving').collection('events').orderBy('version').get();assert.deepEqual(events.docs.map(d=>d.data().version),[1,2,3]);
  const b=(await root.collection('bookings').doc('moving').get()).data(),s=(await root.collection('sessions').doc('moving').get()).data();assert.equal(b.version,s.version);assert.equal(b.date,s.date);
});

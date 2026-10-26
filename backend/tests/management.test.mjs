import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { initializeApp as initAdmin,deleteApp as deleteAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
const require=createRequire(import.meta.url),{initializeApp,deleteApp}=require('firebase/app'),{getAuth,connectAuthEmulator,signInWithEmailAndPassword,confirmPasswordReset}=require('firebase/auth'),{getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions'),{getFirestore,connectFirestoreEmulator,doc,setDoc,getDocFromServer}=require('firebase/firestore');
for(const host of [process.env.FIREBASE_AUTH_EMULATOR_HOST,process.env.FIRESTORE_EMULATOR_HOST])if(!host||!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw new Error('Management tests require loopback emulators.');
const admin=initAdmin({projectId:'demo-lensflow'},'management-tests'),db=adminFirestore(admin),auth=adminAuth(admin),studioId='management-test-a',root=db.doc(`studios/${studioId}`),apps=[],clients={};
const perms={booking:true,calendarCrm:false,payments:false,reports:false},today=new Date(Date.now()+7*3600000).toISOString().slice(0,10),monthStart=`${today.slice(0,7)}-01`;
const call=(role,name,data)=>httpsCallable(clients[role].functions,name,{timeout:45000})({studioId,...data}).then(r=>r.data),denied=e=>e.code==='functions/permission-denied';
function client(name){const app=initializeApp({projectId:'demo-lensflow',apiKey:'demo-key'},name);apps.push(app);const a=getAuth(app);connectAuthEmulator(a,`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`,{disableWarnings:true});const f=getFunctions(app,'asia-southeast2');connectFunctionsEmulator(f,'127.0.0.1',5001);const sdk=getFirestore(app);connectFirestoreEmulator(sdk,'127.0.0.1',8082);return {auth:a,functions:f,db:sdk};}
before(async()=>{
  await db.recursiveDelete(root);
  for(const address of ['m8-invited@lensflow.test','m8-reinvite@lensflow.test']){
    const invitedUid=`staff_${createHash('sha256').update(`${studioId}:${address}`).digest('hex').slice(0,48)}`;
    const orphan=await db.doc(`users/${invitedUid}`).get();if(orphan.exists&&orphan.get('studioId')!==studioId)throw new Error('Unexpected test identity scope');
    await db.doc(`users/${invitedUid}`).delete();try{await auth.deleteUser(invitedUid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  }
  for(const role of ['owner','staff','reports','payments','inactive','other']){
    const uid=`m8-${role}`,sid=role==='other'?'management-test-b':studioId;
    try{await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid,email:`${uid}@lensflow.test`,password:'ManagementTests2026!'});}
    await db.doc(`users/${uid}`).set({studioId:sid,displayName:`Name ${role}`,email:`${uid}@lensflow.test`});await db.doc(`studios/${sid}`).set({name:'Management Studio',timezone:'Asia/Jakarta'});
    await db.doc(`studios/${sid}/members/${uid}`).set({role:role==='owner'?'owner':'staff',status:role==='inactive'?'inactive':'active',permissions:{...perms,reports:role==='reports',payments:role==='payments'}});
    clients[role]=client(`management-${role}`);await signInWithEmailAndPassword(clients[role].auth,`${uid}@lensflow.test`,'ManagementTests2026!');
  }
});
after(async()=>{await Promise.all(apps.map(deleteApp));await deleteAdmin(admin);});
test('report derives exact cash totals and bucket reconciliation from immutable ledger, including negative net',async()=>{
  for(const [id,kind,amount]of [['dp','income_dp',150000],['settle','income_settlement',350000],['refund','refund',600000],['expense','expense',50000]])await root.collection('transactions').doc(id).set({kind,amount,effectiveDate:today});
  const r=await call('owner','reportsRead',{from:monthStart,to:today});assert.equal(r.income,500000);assert.equal(r.refund,600000);assert.equal(r.netIncome,-100000);assert.equal(r.cashNet,-150000);assert.equal(r.count,4);
  for(const key of ['income','refund','expense','count'])assert.equal(r.buckets.reduce((sum,b)=>sum+b[key],0),r[key]);
  assert.equal((await call('reports','reportsRead',{from:monthStart,to:today})).cashNet,-150000);
  for(const role of ['staff','payments','inactive','other'])await assert.rejects(call(role,'reportsRead',{from:monthStart,to:today}),denied);
});
test('report rejects impossible, reversed, future and overly broad dates; empty days remain zero',async()=>{
  for(const [from,to]of [['2026-02-30',today],[today,'2026-02-01'],['2020-01-01',today],[today,'2099-01-01']])await assert.rejects(call('owner','reportsRead',{from,to}),e=>e.code==='functions/invalid-argument');
  const r=await call('owner','reportsRead',{from:'2020-01-01',to:'2020-01-31'});assert.equal(r.count,0);assert.equal(r.buckets.length,31);assert.equal(r.cashNet,0);
  const yearDays=(Date.parse(today)-Date.parse(`${today.slice(0,4)}-01-01`))/86400000+1;
  assert.equal((await call('owner','reportsRead',{from:`${today.slice(0,4)}-01-01`,to:today})).unit,yearDays>100?'month':yearDays>31?'week':'day');
});
test('studio settings are owner-only, versioned and validate quarter-hour times/default DP',async()=>{
  const initial=await call('owner','studioSettings',{});assert.equal(initial.version,0);
  const value={name:'Studio Updated',address:'Jl. Uji',phone:'081234567890',openingTime:'09:00',closingTime:'20:00',defaultDpPercent:40};
  assert.equal((await call('owner','studioSettings',{value,expectedVersion:0})).version,1);
  await assert.rejects(call('owner','studioSettings',{value,expectedVersion:0}),e=>e.code==='functions/aborted');
  for(const patch of [{openingTime:'09:01'},{closingTime:'08:00'},{defaultDpPercent:101},{timezone:'UTC'},{defaultDpPercent:30.5}])await assert.rejects(call('owner','studioSettings',{value:{...value,...patch},expectedVersion:1}),e=>e.code==='functions/invalid-argument');
  for(const role of ['staff','reports','payments','inactive','other'])await assert.rejects(call(role,'studioSettings',{}),denied);
  const rows=await root.collection('transactions').get();assert.equal(rows.size,4);
});
test('profile edits cannot change email, studio or role and cannot overwrite a newer version',async()=>{
  const value={displayName:'Staff Updated',phone:'081234567890',jobTitle:'Fotografer'};
  const next=await call('staff','profileSettings',{value,expectedVersion:0});assert.equal(next.version,1);assert.equal(next.email,'m8-staff@lensflow.test');
  await assert.rejects(call('staff','profileSettings',{value,expectedVersion:0}),e=>e.code==='functions/aborted');
  for(const patch of [{email:'other@example.com'},{studioId:'elsewhere'},{role:'owner'}])await assert.rejects(call('staff','profileSettings',{value:{...value,...patch},expectedVersion:1}),e=>e.code==='functions/invalid-argument');
  assert.equal((await db.doc('users/m8-owner').get()).get('displayName'),'Name owner');
});
let invited;
test('invitation reserves a new account and pending membership; exact retry does not duplicate either',async()=>{
  const value={action:'invite',displayName:'Invited Staff',email:'m8-invited@lensflow.test',permissions:perms,mutationId:'management-invite-0001'};
  invited=await call('owner','staffCommand',value);assert.ok(new URL(invited.link).searchParams.get('oobCode'));assert.equal((await root.collection('members').doc(invited.uid).get()).get('status'),'invited');
  assert.equal((await call('owner','staffCommand',value)).uid,invited.uid);
  await assert.rejects(call('owner','staffCommand',{...value,displayName:'Changed'}),e=>e.code==='functions/already-exists');
  await assert.rejects(call('owner','staffCommand',{...value,email:'m8-other@lensflow.test',mutationId:'management-other-0001'}),e=>e.code==='functions/failed-precondition');
  assert.equal((await root.collection('members').where('status','==','invited').get()).size,1);
  await assert.rejects(call('owner','staffCommand',{action:'update',uid:invited.uid,expectedVersion:1,permissions:perms,status:'active'}),e=>e.code==='functions/failed-precondition');
});
test('Firebase reset token establishes password; only that authenticated identity can accept its invitation',async()=>{
  const c=client('management-invited');clients.invited=c;
  await assert.rejects(call('owner','staffAccept',{}),denied);
  await assert.rejects(httpsCallable(c.functions,'staffAccept')({studioId}),e=>e.code==='functions/unauthenticated');
  const link=await call('owner','staffCommand',{action:'inviteLink',uid:invited.uid}),code=new URL(link.link).searchParams.get('oobCode');
  await confirmPasswordReset(c.auth,code,'InvitedStaff2026!');await signInWithEmailAndPassword(c.auth,'m8-invited@lensflow.test','InvitedStaff2026!');
  assert.equal((await call('invited','staffAccept',{})).accepted,true);assert.equal((await call('invited','staffAccept',{})).accepted,true);
  const m=(await root.collection('members').doc(invited.uid).get()).data();assert.equal(m.status,'active');assert.equal(m.role,'staff');assert.equal(m.version,2);assert.ok(m.acceptedAt);
  await assert.rejects(call('owner','staffCommand',{action:'inviteLink',uid:invited.uid}),e=>e.code==='functions/failed-precondition');
});
test('staff management protects owner, validates all four booleans and enforces version/revocation',async()=>{
  const value={action:'update',uid:invited.uid,expectedVersion:2,permissions:{...perms,reports:true},status:'active'};
  assert.equal((await call('owner','staffCommand',value)).version,3);
  await assert.rejects(call('owner','staffCommand',value),e=>e.code==='functions/aborted');
  await assert.rejects(call('owner','staffCommand',{...value,uid:'m8-owner',expectedVersion:0}),denied);
  await assert.rejects(call('owner','staffCommand',{...value,permissions:{...perms,reports:'true'}}),e=>e.code==='functions/invalid-argument');
  for(const role of ['staff','reports','payments','invited','inactive','other'])await assert.rejects(call(role,'staffList',{}),denied);
  const list=await call('owner','staffList',{});assert.ok(list.items.some(m=>m.uid===invited.uid));assert.equal(JSON.stringify(list).includes('password'),false);
  await call('owner','staffCommand',{...value,expectedVersion:3,status:'inactive'});await assert.rejects(call('invited','profileSettings',{}),denied);await assert.rejects(call('invited','staffAccept',{}),denied);
});
test('raw management writes and cross-studio access stay denied, including for owner',async()=>{
  const sdk=clients.owner.db;
  for(const path of [`studios/${studioId}`,`studios/${studioId}/members/m8-staff`,'users/m8-owner',`studios/${studioId}/staffMutations/fake`,`studios/${studioId}/staffEvents/fake`])await assert.rejects(setDoc(doc(sdk,path),{role:'owner'}),e=>e.code==='permission-denied');
  await assert.rejects(getDocFromServer(doc(sdk,`studios/${studioId}/members/m8-staff`)),e=>e.code==='permission-denied');
  await assert.rejects(call('owner','profileSettings',{studioId:'management-test-b'}),denied);
});
test('a cancelled pending invitation can be reissued without activating membership or duplicating Auth users',async()=>{
  const result=await call('owner','staffCommand',{action:'invite',displayName:'Reinvited Staff',email:'m8-reinvite@lensflow.test',permissions:perms,mutationId:'management-reinvite-001'});
  await call('owner','staffCommand',{action:'update',uid:result.uid,expectedVersion:1,permissions:perms,status:'inactive'});
  await assert.rejects(call('owner','staffCommand',{action:'update',uid:result.uid,expectedVersion:2,permissions:perms,status:'active'}),e=>e.code==='functions/failed-precondition');
  assert.equal((await call('owner','staffList',{})).items.find(m=>m.uid===result.uid).pendingInvitation,true);
  assert.ok((await call('owner','staffCommand',{action:'inviteLink',uid:result.uid})).link);
  const m=(await root.collection('members').doc(result.uid).get()).data();assert.equal(m.status,'invited');assert.equal(m.version,3);assert.equal(m.acceptedAt,undefined);
});

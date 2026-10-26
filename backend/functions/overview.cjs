const { AggregateField,FieldPath,FieldValue,Timestamp }=require('firebase-admin/firestore');
const { createHash }=require('node:crypto');
const { fail,id }=require('./domain.cjs');
const DAY=86400000,RETENTION=30*DAY;
const dateWib=(now=Date.now())=>new Date(now+7*3600000).toISOString().slice(0,10);
const dayShift=(date,n)=>new Date(Date.parse(`${date}T00:00:00Z`)+n*DAY).toISOString().slice(0,10);
const eventId=(kind,key)=>`${kind}_${createHash('sha256').update(key).digest('hex').slice(0,40)}`;
function payload(raw,keys){if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!keys.includes(k)))fail('invalid-argument','Permintaan tidak valid.');id(raw.studioId);return raw;}
async function context(db,uid,studioId,tx){
  if(!uid)fail('unauthenticated','Silakan masuk kembali.');id(uid);id(studioId);const get=ref=>tx?tx.get(ref):ref.get(),root=db.doc(`studios/${studioId}`);
  const [profile,member,studio,prefs]=await Promise.all([get(db.doc(`users/${uid}`)),get(root.collection('members').doc(uid)),get(root),get(root.collection('inboxPreferences').doc(uid))]);
  const m=member.data(),s=studio.data(),p=profile.data();if(!p||p.studioId!==studioId||!s||m?.status!=='active'||!['owner','staff'].includes(m.role))fail('permission-denied','Akses studio tidak tersedia.');
  if(s.timezone&&s.timezone!=='Asia/Jakarta')fail('failed-precondition','Zona studio belum didukung.');
  const owner=m.role==='owner',schedule=owner||m.permissions?.booking===true||m.permissions?.calendarCrm===true,payments=owner||m.permissions?.payments===true,cash=payments||m.permissions?.reports===true;
  const preferences=prefs.data()??{schedule:true,payments:true,reminders:true,version:0};
  if(!['schedule','payments','reminders'].every(k=>typeof preferences[k]==='boolean')||!Number.isInteger(preferences.version))fail('failed-precondition','Preferensi notifikasi belum valid.');
  return {uid,studioId,root,get,member:m,studio:s,profile:p,preferences,permissions:{schedule,payments,cash},kinds:s.inboxEnabled===false?[]:[...(schedule&&preferences.schedule&&s.dailyScheduleInboxEnabled!==false?['schedule']:[]),...(payments&&preferences.payments&&s.paymentInboxEnabled!==false?['payment']:[]),...(payments&&preferences.reminders&&s.reminderInboxEnabled!==false?['reminder']:[])]};
}
async function daySessions(c,date){const page=await c.get(c.root.collection('sessions').where('date','==',date).where('sessionStatus','in',['confirmed','done']).orderBy('startAt').limit(101));if(page.size>100)fail('resource-exhausted','Jadwal studio perlu diperiksa.');return page.docs;}
function sessionData(s){const d=s.data();return {id:s.id,code:d.code,clientName:d.clientName,packageName:d.packageName,date:d.date,startTime:d.startTime,endTime:d.endTime,startAt:d.startAt.toMillis(),endAt:d.endAt.toMillis(),location:d.location,sessionStatus:d.sessionStatus,paymentStatus:d.paymentStatus};}
async function dashboard(db,uid,raw,now=Date.now()){
  const d=payload(raw,['studioId']),c=await context(db,uid,d.studioId),today=dateWib(now),result={today,generatedAt:now,canSeeSchedule:c.permissions.schedule,canSeeCash:c.permissions.cash};
  const tasks=[];
  if(c.permissions.schedule)tasks.push((async()=>{const [todayRows,next]=await Promise.all([daySessions(c,today),c.get(c.root.collection('sessions').where('sessionStatus','==','confirmed').where('endAt','>',Timestamp.fromMillis(now)).orderBy('endAt').limit(5))]);result.sessionCount=todayRows.length;result.doneCount=todayRows.filter(s=>s.get('sessionStatus')==='done').length;result.upcoming=next.docs.map(sessionData);})());
  if(c.permissions.cash)tasks.push((async()=>{const base=c.root.collection('transactions').where('effectiveDate','==',today);const [gross,refund]=await Promise.all([base.where('kind','in',['income_dp','income_settlement']).aggregate({amount:AggregateField.sum('amount')}).get(),base.where('kind','==','refund').aggregate({amount:AggregateField.sum('amount')}).get()]);result.cashIn=gross.data().amount;result.refundOut=refund.data().amount;})());
  await Promise.all(tasks);return result;
}
async function sync(db,uid,raw,now=Date.now()){
  const d=payload(raw,['studioId']);return db.runTransaction(async tx=>{
    const c=await context(db,uid,d.studioId,tx),today=dateWib(now),hour=new Date(now+7*3600000).getUTCHours(),stateRef=c.root.collection('inboxSyncState').doc(uid),state=(await tx.get(stateRef)).data()??{},items=c.root.collection('inboxes').doc(uid).collection('items'),candidates=[];
    if(c.kinds.includes('schedule')&&hour>=7){const rows=await daySessions(c,today);if(rows.length)candidates.push({id:eventId('schedule',today),kind:'schedule',date:today,createdAt:Timestamp.fromMillis(now)});}
    if(c.kinds.includes('reminder')&&hour>=9){
      const dates=[dayShift(today,1),dayShift(today,3)],page=await tx.get(c.root.collection('bookings').where('date','in',dates).where('sessionStatus','==','confirmed').limit(201));if(page.size>200)fail('resource-exhausted','Jadwal studio perlu diperiksa.');
      for(const s of page.docs){const b=s.data(),remaining=b.total-(b.paidAmount??0)+(b.refundedAmount??0);if(Number.isSafeInteger(remaining)&&remaining>0&&b.startAt.toMillis()>now){const offset=b.date===dates[0]?1:3;candidates.push({id:eventId('reminder',`${s.id}_${b.date}_${offset}`),kind:'reminder',date:b.date,offset,bookingId:s.id,createdAt:Timestamp.fromMillis(now)});}}
    }
    let paymentCursor=state.paymentCursor,pending=false;
    if(c.kinds.includes('payment')){
      const cutoff=Math.max(now-RETENTION,state.paymentsSince?.toMillis?.()??0,c.member.createdAt?.toMillis?.()??0);
      let q=c.root.collection('transactions').where('kind','in',['income_dp','income_settlement']).where('createdAt','>=',Timestamp.fromMillis(cutoff)).where('createdAt','<=',Timestamp.fromMillis(now)).orderBy('createdAt').orderBy(FieldPath.documentId());
      if(paymentCursor&&paymentCursor[0]*1000+paymentCursor[1]/1000000>=cutoff)q=q.startAfter(new Timestamp(paymentCursor[0],paymentCursor[1]),paymentCursor[2]);
      const page=await tx.get(q.limit(26)),visible=page.docs.slice(0,25);pending=page.size>25;
      for(const s of visible)candidates.push({id:eventId('payment',s.id),kind:'payment',date:s.get('effectiveDate'),entryId:s.id,bookingId:s.get('bookingId'),createdAt:s.get('createdAt')});
      const last=visible.at(-1);if(last){const t=last.get('createdAt');paymentCursor=[t.seconds,t.nanoseconds,last.id];}
    }
    const existing=await Promise.all(candidates.map(item=>tx.get(items.doc(item.id))));let created=0;
    candidates.forEach((item,i)=>{if(!existing[i].exists){const {id:notificationId,...body}=item;tx.create(items.doc(notificationId),{...body,readAt:null});created++;}});
    if(paymentCursor)tx.set(stateRef,{...state,paymentCursor,updatedAt:FieldValue.serverTimestamp()});
    return {created,pending};
  },{maxAttempts:5});
}
function cacheRead(c){const docs=new Map();return ref=>{if(!docs.has(ref.path))docs.set(ref.path,c.get(ref));return docs.get(ref.path);};}
async function present(c,s,now,read,days){
  const n=s.data();if(!n||!c.kinds.includes(n.kind))return null;let title,message,target;
  if(n.kind==='schedule'){
    if(!days.has(n.date))days.set(n.date,daySessions(c,n.date));const rows=await days.get(n.date);if(!rows.length)return null;title='Ringkasan jadwal';message=`${rows.length} sesi pada ${n.date}.`;target={kind:'calendar',date:n.date};
  }else if(n.kind==='reminder'){
    const b=(await read(c.root.collection('bookings').doc(id(n.bookingId)))).data();if(!b||b.sessionStatus!=='confirmed'||b.date!==n.date||b.startAt.toMillis()<=now)return null;const remaining=b.total-(b.paidAmount??0)+(b.refundedAmount??0);if(!Number.isSafeInteger(remaining)||remaining<=0)return null;
    title=`Pengingat pelunasan H-${n.offset}`;message=`${b.code} · ${n.date}. Sisa ${new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(remaining)}.`;target={kind:'financeBooking',id:n.bookingId};
  }else if(n.kind==='payment'){
    const entry=(await read(c.root.collection('transactions').doc(id(n.entryId)))).data();if(!entry||!['income_dp','income_settlement'].includes(entry.kind))return null;title=entry.kind==='income_dp'?'DP diterima':'Pelunasan diterima';message=`${entry.bookingCode} · ${new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(entry.amount)} · ${entry.effectiveDate}.`;target={kind:'financeEntry',id:n.entryId};
  }else return null;
  return {id:s.id,kind:n.kind,title,message,target,createdAt:n.createdAt.toMillis(),readAt:n.readAt?.toMillis()??null};
}
async function list(db,uid,raw,now=Date.now()){
  const d=payload(raw,['studioId','next']);const generated=await sync(db,uid,{studioId:d.studioId},now),c=await context(db,uid,d.studioId);if(!c.kinds.length)return {items:[],next:null,pending:false};
  let q=c.root.collection('inboxes').doc(uid).collection('items').where('kind','in',c.kinds).where('createdAt','>=',Timestamp.fromMillis(now-RETENTION)).where('createdAt','<=',Timestamp.fromMillis(now)).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
  if(d.next){if(!Array.isArray(d.next)||d.next.length!==3||!d.next.slice(0,2).every(Number.isInteger))fail('invalid-argument','Halaman tidak valid.');q=q.startAfter(new Timestamp(d.next[0],d.next[1]),id(d.next[2]));}
  const page=await q.limit(101).get(),read=cacheRead(c),days=new Map(),items=[];let scanned=0,last;
  for(const s of page.docs.slice(0,100)){scanned++;last=s;const item=await present(c,s,now,read,days);if(item)items.push(item);if(items.length===25)break;}
  const more=page.size>scanned,t=last?.get('createdAt');return {items,next:more?[t.seconds,t.nanoseconds,last.id]:null,pending:generated.pending};
}
async function mark(db,uid,raw,now=Date.now()){
  const d=payload(raw,['studioId','id']);id(d.id);return db.runTransaction(async tx=>{
    const c=await context(db,uid,d.studioId,tx),ref=c.root.collection('inboxes').doc(uid).collection('items').doc(d.id),s=await tx.get(ref);
    if(!s.exists||s.get('createdAt').toMillis()<now-RETENTION)fail('not-found','Notifikasi tidak tersedia.');const result=await present(c,s,now,cacheRead(c),new Map());if(!result)fail('failed-precondition','Notifikasi sudah tidak berlaku atau tidak lagi dapat diakses.');if(!s.get('readAt'))tx.update(ref,{readAt:FieldValue.serverTimestamp()});return {target:result.target};
  });
}
async function preferences(db,uid,raw,now=Date.now()){
  const d=payload(raw,['studioId','value','expectedVersion']);if(d.value===undefined){const p=(await context(db,uid,d.studioId)).preferences;return {schedule:p.schedule,payments:p.payments,reminders:p.reminders,version:p.version};}
  if(!d.value||Object.keys(d.value).length!==3||!['schedule','payments','reminders'].every(k=>typeof d.value[k]==='boolean')||!Number.isInteger(d.expectedVersion))fail('invalid-argument','Preferensi tidak valid.');
  return db.runTransaction(async tx=>{const c=await context(db,uid,d.studioId,tx),ref=c.root.collection('inboxPreferences').doc(uid);if(c.preferences.version!==d.expectedVersion)fail('aborted','Preferensi berubah. Muat ulang sebelum menyimpan.');let state, stateRef;if(c.preferences.payments!==d.value.payments){stateRef=c.root.collection('inboxSyncState').doc(uid);state=(await tx.get(stateRef)).data()??{};}
    const value={...d.value,version:c.preferences.version+1};tx.set(ref,{...value,updatedAt:FieldValue.serverTimestamp()});if(stateRef)tx.set(stateRef,{...state,paymentCursor:null,paymentsSince:Timestamp.fromMillis(now),updatedAt:FieldValue.serverTimestamp()});return value;
  });
}
async function dispatch(db,{maxUsers=200,now=Date.now(),studioIds}={}){
  if(studioIds){if(!Array.isArray(studioIds)||!studioIds.length||studioIds.length>10)fail('invalid-argument','Lingkup worker tidak valid.');studioIds.forEach(id);}
  const scope=studioIds?createHash('sha256').update([...studioIds].sort().join(',')).digest('hex').slice(0,20):'',checkpoint=db.doc(`system/inboxDispatch${scope?'_'+scope:''}`),cursor=(await checkpoint.get()).data()??{},started=Date.now();let processed=0,skipped=0,afterStudio=cursor.studioId??null;
  let base=db.collection('studios').orderBy(FieldPath.documentId());if(studioIds)base=base.where(FieldPath.documentId(),'in',studioIds);let studies=base;if(afterStudio)studies=studies.startAt(afterStudio);
  while(true){const page=await studies.limit(25).get();if(page.empty)break;
    for(const studio of page.docs){let members=studio.ref.collection('members').where('status','==','active').orderBy(FieldPath.documentId());if(studio.id===cursor.studioId&&cursor.memberId)members=members.startAfter(cursor.memberId);
      while(true){const batch=await members.limit(50).get();for(const member of batch.docs){try{await sync(db,member.id,{studioId:studio.id},now);}catch(e){if(!['permission-denied','failed-precondition'].includes(e.code))throw e;skipped++;}processed++;
        if(processed>=maxUsers||Date.now()-started>480000){await checkpoint.set({studioId:studio.id,memberId:member.id,updatedAt:FieldValue.serverTimestamp()});return {processed,skipped,pending:true};}}
        if(batch.size<50)break;members=members.startAfter(batch.docs.at(-1));
      }
    }
    if(page.size<25)break;afterStudio=page.docs.at(-1).id;studies=base.startAfter(afterStudio);
  }
  await checkpoint.set({studioId:null,memberId:null,updatedAt:FieldValue.serverTimestamp()});return {processed,skipped,pending:false};
}
module.exports={dashboard,sync,list,mark,preferences,dispatch,eventId,dateWib};

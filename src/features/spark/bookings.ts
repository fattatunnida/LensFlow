import { collection,documentId,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,startAfter,where,type QueryConstraint } from 'firebase/firestore';
import { context,fail,identifier,moneyData,normalize,ref,requireSpark,rootRef,schedule,searchTokens,sessionData,text,type Data } from './core';
export async function choices(d:Data){
  const c=await context(d.studioId,'booking'),settings={dpPercent:c.studio.defaultDpPercent??30,openingTime:c.studio.openingTime??'08:00',closingTime:c.studio.closingTime??'21:00',timezone:c.studio.timezone??'Asia/Jakarta'};
  if(!['clients','packages'].includes(d.kind))fail('invalid-argument','Pilihan tidak valid.');const kind=d.kind==='clients'?'clientChoices':'packages';
  const decode=(id:string,v:Data)=>d.kind==='clients'?{id,name:v.name,phone:v.phone,email:v.email??'',version:v.version}:{id,name:v.name,price:v.price,durationMinutes:v.durationMinutes,editedPhotosCount:v.editedPhotosCount,defaultLocation:v.defaultLocation,description:v.description??'',version:v.version};
  if(d.id){const s=await getDocFromServer(ref(d.studioId,kind,identifier(d.id)));return {items:s.exists()&&(d.kind==='clients'||s.get('isActive')===true)?[decode(s.id,s.data()!)]:[],next:null,settings};}
  const term=normalize(text(d.search??'',0,100,'Pencarian'));let field='nameKey',prefix=term;if(d.kind==='clients'&&/^[+\d][\d\s()+.-]*$/.test(term)){field='phone';prefix=term.replace(/[\s().-]/g,'');if(prefix.startsWith('0'))prefix='+62'+prefix.slice(1);else if(prefix.startsWith('62'))prefix='+'+prefix;}
  const constraints:QueryConstraint[]=[];if(d.kind==='packages')constraints.push(where('isActive','==',true));if(prefix)constraints.push(where(field,'>=',prefix),where(field,'<=',prefix+'\uf8ff'));constraints.push(orderBy(field),orderBy(documentId()));if(d.next)constraints.push(startAfter(d.next[0],identifier(d.next[1])));constraints.push(limit(26));
  const page=await getDocsFromServer(query(collection(rootRef(d.studioId),kind),...constraints)),rows=page.docs.slice(0,25),last=rows.at(-1);return {items:rows.map(s=>decode(s.id,s.data())),next:page.size>25?[last!.get(field),last!.id]:null,settings};
}
export async function availability(d:Data){const c=await context(d.studioId,'booking'),range=schedule(d,c.studio),lock=await getDocFromServer(ref(d.studioId,'scheduleLocks',d.date));return {available:!Object.entries(lock.data()?.entries??{}).some(([id,v])=>id!==d.exceptId&&(v as Data).startMs<range.endAt.toMillis()&&range.startAt.toMillis()<(v as Data).endMs)};}
export async function command(d:Data){
  const c=await context(d.studioId,'booking');requireSpark(c.studio);identifier(d.bookingId);identifier(d.mutationId);if(d.mutationId.length<12||!['create','reschedule','cancel','edit','complete'].includes(d.action))fail('invalid-argument','Perintah booking tidak valid.');
  const receipt=ref(d.studioId,'bookingMutations',`${c.uid}_${d.mutationId}`),bookingRef=ref(d.studioId,'bookings',d.bookingId),fingerprint=JSON.stringify(d);
  return runTransaction(c.db,async tx=>{
    const [prior,old,studioDoc]=await Promise.all([tx.get(receipt),tx.get(bookingRef),tx.get(rootRef(d.studioId))]);if(prior.exists()){if(prior.get('fingerprint')!==fingerprint)fail('already-exists','Identitas percobaan dipakai untuk isian lain.','mutation-conflict');return prior.get('result');}
    const studio=studioDoc.data()!;let b:Data={...old.data()},range:ReturnType<typeof schedule>|undefined,counter,number=0;
    if(d.action==='create'){
      if(old.exists())fail('already-exists','Booking sudah tersedia.','version-conflict');if(d.expectedVersion!==null)fail('invalid-argument','Versi booking baru tidak valid.');
      const [customer,pkg,count]=await Promise.all([tx.get(ref(d.studioId,'clientChoices',identifier(d.clientId))),tx.get(ref(d.studioId,'packages',identifier(d.packageId))),tx.get(ref(d.studioId,'bookingCounters','main'))]);
      const client=customer.data(),p=pkg.data();if(!client||!p||p.isActive!==true||client.version!==d.clientVersion||p.version!==d.packageVersion||d.dpPercent!==(studio.defaultDpPercent??30))fail('failed-precondition','Pelanggan, paket atau target DP berubah. Pilih ulang.','selection-stale');
      range=schedule(d,studio);number=(count.get('value')??0)+1;counter=count.ref;
      b={bookingId:d.bookingId,code:`BK-${String(number).padStart(6,'0')}`,clientId:d.clientId,packageId:d.packageId,clientName:client.name,clientPhone:client.phone,clientEmail:client.email??'',packageName:p.name,packageSnapshot:{name:p.name,price:p.price,durationMinutes:p.durationMinutes,editedPhotosCount:p.editedPhotosCount,defaultLocation:p.defaultLocation},total:p.price,paidAmount:0,refundedAmount:0,netPaidAmount:0,refundStatus:'none',dpPercent:d.dpPercent,dpTarget:Math.floor((p.price*d.dpPercent+50)/100),paymentStatus:'pending_dp',sessionStatus:'confirmed',notes:text(d.notes,0,2000,'Catatan'),location:text(d.location,1,200,'Lokasi'),cancellationReason:'',createdBy:c.uid,createdAt:serverTimestamp(),version:0,lastEntryId:''};
    }else{
      if(!old.exists())fail('not-found','Booking tidak tersedia.');if(b.version!==d.expectedVersion)fail('aborted','Booking telah berubah. Muat ulang.','version-conflict');if(b.sessionStatus!=='confirmed')fail('failed-precondition','Booking selesai atau batal tidak dapat diubah.','terminal');
      if(d.action==='reschedule')range=schedule(d,studio);
      if(['reschedule','edit'].includes(d.action))b.location=text(d.location,1,200,'Lokasi');
      if(d.action==='edit')b.notes=text(d.notes,0,2000,'Catatan');
      if(d.action==='cancel'){b.sessionStatus='cancelled';b.cancellationReason=text(d.reason,3,500,'Alasan');}
      if(d.action==='complete'){if(b.startAt.toMillis()>Date.now())fail('failed-precondition','Sesi belum dimulai.');b.sessionStatus='done';}
    }
    const days=[...new Set([old.get('date'),range?.date].filter(Boolean))] as string[],locks=['create','reschedule','cancel'].includes(d.action)?await Promise.all(days.map(date=>tx.get(ref(d.studioId,'scheduleLocks',date)))):[];
    if(range)Object.assign(b,range);b={...b,version:b.version+1,updatedBy:c.uid,updatedAt:serverTimestamp(),writeAction:d.action,mutationId:d.mutationId,writeReason:['cancel','reschedule'].includes(d.action)?text(d.reason,3,500,'Alasan'):''};b.searchTokens=searchTokens(b.clientName,b.packageName,b.code,b.date);
    for(const lock of locks){const before=lock.data()??{entries:{},order:[],revision:0},entries={...before.entries};delete entries[d.bookingId];let order=(before.order as string[]).filter(id=>id!==d.bookingId),position=0;
      if(lock.id===b.date&&b.sessionStatus!=='cancelled'){
        const item={startMs:b.startAt.toMillis(),endMs:b.endAt.toMillis()};if(Object.values(entries).some(v=>(v as Data).startMs<item.endMs&&item.startMs<(v as Data).endMs))fail('already-exists','Jadwal bentrok. Pilih jam lain.','schedule-conflict');entries[d.bookingId]=item;order=[...order,d.bookingId].sort((a,z)=>entries[a].startMs-entries[z].startMs);position=order.indexOf(d.bookingId);
      }
      tx.set(lock.ref,{entries,order,index:position,changedBooking:d.bookingId,lastMutation:d.mutationId,revision:before.revision+1,updatedBy:c.uid,updatedAt:serverTimestamp()});
    }
    if(counter)tx.set(counter,{value:number,lastBookingId:d.bookingId,updatedAt:serverTimestamp()});
    const result={id:d.bookingId,version:b.version,code:b.code},event={action:d.action,actorId:c.uid,reason:b.writeReason,version:b.version,date:b.date,startTime:b.startTime,endTime:b.endTime,sessionStatus:b.sessionStatus,createdAt:serverTimestamp()};
    tx.set(bookingRef,b);tx.set(ref(d.studioId,'sessions',d.bookingId),sessionData(b,d.bookingId));tx.set(ref(d.studioId,'financeContexts',d.bookingId),moneyData(b,d.bookingId));tx.set(receipt,{fingerprint,result,uid:c.uid,bookingId:d.bookingId,mutationId:d.mutationId,...event});
    return result;
  },{maxAttempts:5});
}

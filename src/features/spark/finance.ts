import { collection,documentId,getDocFromServer,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,startAfter,Timestamp,where,type QueryConstraint } from 'firebase/firestore';
import { context,cursorStamp,dateWib,dayMs,fail,identifier,moneyData,normalize,ref,requireSpark,rootRef,text,validDate,type Data } from './core';
const incomes=['income_dp','income_settlement'],categories=['operasional','sewa_alat','cetak','utilitas','konsumsi','lainnya'];
export async function command(d:Data){
  const income=incomes.includes(d.kind),c=await context(d.studioId,income?'payments':'owner');requireSpark(c.studio);identifier(d.entryId);identifier(d.mutationId);
  if(![...incomes,'expense','refund'].includes(d.kind)||d.acknowledged!==true||!Number.isSafeInteger(d.amount)||d.amount<=0||d.amount>1000000000||!['transfer','qris'].includes(d.method)||!validDate(d.effectiveDate)||d.mutationId.length<12)fail('invalid-argument','Periksa jenis, nominal, metode, tanggal dan konfirmasi uang.');
  const description=text(d.description,income?0:3,500,'Uraian/alasan');if(d.kind==='expense'&&!categories.includes(d.category))fail('invalid-argument','Kategori tidak valid.');
  const receipt=ref(d.studioId,'financeMutations',`${c.uid}_${d.mutationId}`),entryRef=ref(d.studioId,'transactions',d.entryId),headRef=ref(d.studioId,'financeCounters','main'),fingerprint=JSON.stringify(d);
  return runTransaction(c.db,async tx=>{
    const [prior,existing,head,studioDoc]=await Promise.all([tx.get(receipt),tx.get(entryRef),tx.get(headRef),tx.get(rootRef(d.studioId))]);
    if(prior.exists()){if(prior.get('hash')!==fingerprint)fail('already-exists','Identitas percobaan dipakai untuk isian lain.','mutation-conflict');return prior.get('result');}if(existing.exists())fail('already-exists','Transaksi sudah tercatat.','entry-exists');
    const studio=studioDoc.data()!,back=studio.maxFinanceBackdateDays??30,today=dateWib();if(d.effectiveDate>today||(!c.owner&&d.effectiveDate!==today)||(c.owner&&dayMs(today)-dayMs(d.effectiveDate)>back*86400000))fail('invalid-argument','Tanggal transaksi di luar batas studio.');
    let b:Data|undefined,source:Data|undefined,counter:Data|undefined,oldVersion:number|null=null;
    if(d.kind!=='expense'){
      identifier(d.bookingId);const money=await tx.get(ref(d.studioId,'financeContexts',d.bookingId));if(!money.exists())fail('not-found','Booking tidak tersedia.');const ctx=money.data()!;
      if(ctx.version!==d.expectedVersion)fail('aborted','Saldo atau booking berubah. Muat data terbaru.','version-conflict');oldVersion=ctx.version;
      if(income){if(ctx.sessionStatus==='cancelled'||ctx.collectible<=0)fail('failed-precondition','Booking batal atau sudah lunas.');if(d.kind==='income_dp'&&d.amount>=ctx.remaining)fail('invalid-argument','DP harus kurang dari sisa. Gunakan Pelunasan.');if(d.kind==='income_settlement'&&d.amount!==ctx.remaining)fail('invalid-argument','Pelunasan harus sama dengan seluruh sisa.');}
      else{
        identifier(d.originalEntryId);const [original,balance]=await Promise.all([tx.get(ref(d.studioId,'transactions',d.originalEntryId)),tx.get(ref(d.studioId,'refundBalances',d.originalEntryId))]);source=original.data();counter=balance.data()??{amount:0,version:0};
        if(ctx.sessionStatus!=='cancelled'||!source||source.bookingId!==d.bookingId||!incomes.includes(source.kind)||d.amount>source.amount-counter.amount||d.effectiveDate<source.effectiveDate)fail('invalid-argument','Refund memerlukan booking batal, pembayaran asal dan batas refundable yang sesuai.');
      }
      const paid=ctx.receivedAmount+(income?d.amount:0),refund=ctx.refundedAmount+(d.kind==='refund'?d.amount:0);
      b={...ctx,paidAmount:paid,refundedAmount:refund,netPaidAmount:paid-refund,paymentStatus:paid-refund===ctx.total?'paid':paid?'dp_paid':'pending_dp',refundStatus:refund===0?'none':refund===paid?'full':'partial',version:ctx.version+1,updatedBy:c.uid,updatedAt:serverTimestamp(),writeAction:d.kind,mutationId:d.mutationId,writeReason:description,lastEntryId:d.entryId};
    }
    const sequence=(head.get('count')??0)+1,entry={id:d.entryId,studioId:d.studioId,kind:d.kind,amount:d.amount,method:d.method,effectiveDate:d.effectiveDate,effectiveAt:Timestamp.fromMillis(dayMs(d.effectiveDate)),description,category:d.kind==='expense'?d.category:'',bookingId:b?d.bookingId:'',bookingCode:b?.code??'',clientName:b?.clientName??'',originalEntryId:d.kind==='refund'?d.originalEntryId:'',createdAt:serverTimestamp(),createdBy:c.uid,createdByName:c.profile.displayName,mutationId:d.mutationId,acknowledgedBy:c.uid,sequence,expectedVersion:oldVersion,bookingDate:b?.date??'',bookingStartTime:b?.startTime??'',bookingEndTime:b?.endTime??'',sessionStatus:b?.sessionStatus??''};
    const result={entryId:d.entryId,bookingId:b?d.bookingId:'',bookingVersion:b?.version??null};
    tx.set(entryRef,entry);tx.set(receipt,{hash:fingerprint,result,uid:c.uid,mutationId:d.mutationId,entryId:d.entryId,createdAt:serverTimestamp()});tx.set(headRef,{count:sequence,lastEntryId:d.entryId,updatedAt:serverTimestamp()});
    if(b){
      const financial={paidAmount:b.paidAmount,refundedAmount:b.refundedAmount,netPaidAmount:b.netPaidAmount,paymentStatus:b.paymentStatus,refundStatus:b.refundStatus,version:b.version,updatedBy:c.uid,updatedAt:serverTimestamp(),writeAction:d.kind,mutationId:d.mutationId,writeReason:description,lastEntryId:d.entryId};
      // Payments-only users never read the private booking or session document.
      // Rules validate these blind updates against the same ledger/context commit.
      tx.update(ref(d.studioId,'bookings',d.bookingId),financial);
      tx.update(ref(d.studioId,'sessions',d.bookingId),{paymentStatus:b.paymentStatus,version:b.version,updatedAt:serverTimestamp(),stateKey:b.sessionStatus==='done'?'done':b.sessionStatus==='cancelled'?'cancelled':b.paymentStatus});
      tx.set(ref(d.studioId,'financeContexts',d.bookingId),moneyData(b,d.bookingId));
    }
    if(counter)tx.set(ref(d.studioId,'refundBalances',d.originalEntryId),{amount:counter.amount+d.amount,version:counter.version+1,lastEntryId:d.entryId,updatedAt:serverTimestamp()});
    return result;
  },{maxAttempts:5});
}
export async function bookings(d:Data){
  await context(d.studioId,'finance');const decode=(id:string,v:Data)=>({...v,id});if(d.id){const s=await getDocFromServer(ref(d.studioId,'financeContexts',identifier(d.id)));return {items:s.exists()?[decode(s.id,s.data()!)]:[],next:null};}
  const clauses:QueryConstraint[]=[],term=normalize(text(d.search??'',0,64,'Pencarian'));if(term)clauses.push(where('searchTokens','array-contains',term));clauses.push(orderBy('startAt','desc'),orderBy(documentId(),'desc'));if(d.next)clauses.push(startAfter(Timestamp.fromMillis(d.next[0]),identifier(d.next[1])));clauses.push(limit(26));
  const page=await getDocsFromServer(query(collection(rootRef(d.studioId),'financeContexts'),...clauses)),rows=page.docs.slice(0,25),last=rows.at(-1);return {items:rows.map(s=>decode(s.id,s.data())),next:page.size>25?[last!.get('startAt').toMillis(),last!.id]:null};
}
export async function sources(d:Data){
  await context(d.studioId,'owner');identifier(d.bookingId);const clauses:QueryConstraint[]=[where('bookingId','==',d.bookingId),where('kind','in',incomes),orderBy('createdAt','desc'),orderBy(documentId(),'desc')];if(d.next)clauses.push(startAfter(cursorStamp(d.next),identifier(d.next[2])));clauses.push(limit(26));
  const page=await getDocsFromServer(query(collection(rootRef(d.studioId),'transactions'),...clauses)),rows=page.docs.slice(0,25),balances=await Promise.all(rows.map(s=>getDocFromServer(ref(d.studioId,'refundBalances',s.id)))),last=rows.at(-1),stamp=last?.get('createdAt');
  return {items:rows.map((s,i)=>({id:s.id,amount:s.get('amount'),method:s.get('method'),effectiveDate:s.get('effectiveDate'),refundedAmount:balances[i].get('amount')??0,remaining:s.get('amount')-(balances[i].get('amount')??0)})),next:page.size>25?[stamp.seconds,stamp.nanoseconds,last!.id]:null};
}

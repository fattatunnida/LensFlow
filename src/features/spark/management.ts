import { collection,doc,documentId,getDocsFromServer,limit,orderBy,query,runTransaction,serverTimestamp,startAfter,Timestamp,where,type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { context,DAY,fail,identifier,ref,requireSpark,rootRef,text,type Data } from './core';
function email(v:unknown){const e=text(v,3,254,'Email').toLowerCase();if(!/^[a-z0-9._+%-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e))fail('invalid-argument','Email tidak valid.');return e;}
function perms(v:Data){if(!v||Object.keys(v).length!==4||!['booking','calendarCrm','payments','reports'].every(k=>typeof v[k]==='boolean'))fail('invalid-argument','Empat izin harus berupa boolean.');return v;}
function phone(v:unknown){const p=text(v,0,24,'Telepon');if(p&&!/^\+?[0-9 ()-]{8,24}$/.test(p))fail('invalid-argument','Telepon tidak valid.');return p;}
export async function studio(d:Data){const c=await context(d.studioId,'owner');const decode=(s:Data)=>({name:s.name,address:s.address??'',phone:s.phone??'',openingTime:s.openingTime??'08:00',closingTime:s.closingTime??'21:00',defaultDpPercent:s.defaultDpPercent??30,timezone:s.timezone??'Asia/Jakarta',version:s.settingsVersion??0});if(!d.value)return decode(c.studio);
  const value={name:text(d.value.name,2,100,'Nama studio'),address:text(d.value.address,0,500,'Alamat'),phone:phone(d.value.phone),openingTime:d.value.openingTime,closingTime:d.value.closingTime,defaultDpPercent:d.value.defaultDpPercent};
  return runTransaction(c.db,async tx=>{const s=await tx.get(rootRef(d.studioId));if((s.get('settingsVersion')??0)!==d.expectedVersion)fail('aborted','Pengaturan berubah. Muat ulang dahulu.');tx.update(s.ref,{...value,settingsVersion:d.expectedVersion+1,updatedBy:c.uid,updatedAt:serverTimestamp()});return {...decode(s.data()!),...value,version:d.expectedVersion+1};});
}
export async function profile(d:Data){const c=await context(d.studioId);const decode=(p:Data)=>({displayName:p.displayName,email:p.email,phone:p.phone??'',jobTitle:p.jobTitle??'',version:p.version??0});if(!d.value)return decode(c.profile);
  const value={displayName:text(d.value.displayName,2,100,'Nama'),phone:phone(d.value.phone),jobTitle:text(d.value.jobTitle,0,80,'Jabatan')};
  return runTransaction(c.db,async tx=>{const [p,m]=await Promise.all([tx.get(doc(c.db,'users',c.uid)),tx.get(ref(d.studioId,'members',c.uid))]);if((p.get('version')??0)!==d.expectedVersion)fail('aborted','Profil berubah. Muat ulang dahulu.');tx.update(p.ref,{...value,version:d.expectedVersion+1,updatedAt:serverTimestamp()});tx.update(m.ref,{displayName:value.displayName,version:(m.get('version')??0)+1,updatedAt:serverTimestamp(),updatedBy:c.uid});return {...decode(p.data()!),...value,version:d.expectedVersion+1};});
}
export async function staff(d:Data){const c=await context(d.studioId,'owner'),after=typeof d.after==='string'?d.after:'',invitePhase=after.startsWith('i:'),items:Data[]=[];
  if(!invitePhase){const clauses=[orderBy(documentId()),...(after.startsWith('m:')?[startAfter(identifier(after.slice(2)))]:[]),limit(26)],page=await getDocsFromServer(query(collection(rootRef(d.studioId),'members'),...clauses));
    for(const s of page.docs.slice(0,25)){const m=s.data();items.push({uid:s.id,displayName:m.displayName??(s.id===c.uid?c.profile.displayName:'Staf studio'),email:m.email??(s.id===c.uid?c.profile.email:''),role:m.role,status:m.status,permissions:m.permissions,version:m.version??0,pendingInvitation:false});}if(page.size>25)return {items,next:`m:${page.docs[24].id}`};}
  const room=25-items.length,afterId=invitePhase?after.slice(2):'',clauses=[where('status','in',['pending','cancelled']),orderBy(documentId()),...(afterId?[startAfter(afterId)]:[]),limit(room+1)],page=await getDocsFromServer(query(collection(rootRef(d.studioId),'invitations'),...clauses));
  for(const s of page.docs.slice(0,room)){const v=s.data();items.push({uid:`invite:${s.id}`,displayName:v.displayName,email:v.email,role:'staff',status:v.status==='pending'?'invited':'inactive',permissions:v.permissions,version:v.version,pendingInvitation:true});}
  return {items,next:page.size>room?`i:${room?page.docs[room-1].id:afterId}`:null};
}
export async function staffCommand(d:Data){
  const c=await context(d.studioId,'owner');requireSpark(c.studio);
  if(d.action==='invite'){
    const address=email(d.email),name=text(d.displayName,2,100,'Nama staf'),permissions=perms(d.permissions),inv=ref(d.studioId,'invitations',address);
    await runTransaction(c.db,async tx=>{const s=await tx.get(inv);if(s.exists()){if(s.get('status')==='pending'&&s.get('mutationId')===d.mutationId&&s.get('displayName')===name&&JSON.stringify(s.get('permissions'))===JSON.stringify(permissions))return;fail('already-exists','Undangan sudah ada. Gunakan Atur akses atau Buat tautan.');}tx.set(inv,{email:address,displayName:name,permissions,status:'pending',version:1,mutationId:identifier(d.mutationId),expiresAt:Timestamp.fromMillis(Date.now()+7*DAY-300000),createdAt:serverTimestamp(),createdBy:c.uid,updatedAt:serverTimestamp(),updatedBy:c.uid});});
    return {uid:`invite:${address}`,studioId:d.studioId,inviteId:address,email:address};
  }
  const isInvite=typeof d.uid==='string'&&d.uid.startsWith('invite:'),target=isInvite?email(d.uid.slice(7)):identifier(d.uid),targetRef=ref(d.studioId,isInvite?'invitations':'members',target);
  if(d.action==='inviteLink'){
    if(!isInvite)fail('failed-precondition','Akun ini sudah menerima undangan.');await runTransaction(c.db,async tx=>{const s=await tx.get(targetRef);if(!s.exists()||!['pending','cancelled'].includes(s.get('status')))fail('failed-precondition','Undangan tidak tersedia.');tx.update(s.ref,{status:'pending',expiresAt:Timestamp.fromMillis(Date.now()+7*DAY-300000),version:s.get('version')+1,updatedBy:c.uid,updatedAt:serverTimestamp()});});return {uid:d.uid,studioId:d.studioId,inviteId:target,email:target};
  }
  if(d.action!=='update')fail('invalid-argument','Aksi tidak valid.');const permissions=perms(d.permissions);
  return runTransaction(c.db,async tx=>{const s=await tx.get(targetRef),old=s.data();if(!old)fail('not-found','Staf tidak tersedia.');if((old.version??0)!==d.expectedVersion)fail('aborted','Data staf berubah. Muat ulang.');if(!isInvite&&(old.role!=='staff'||target===c.uid))fail('permission-denied','Owner terkunci.');
    const status=isInvite?d.status==='invited'?'pending':d.status==='inactive'?'cancelled':null:['active','inactive'].includes(d.status)?d.status:null;if(!status)fail('invalid-argument','Status tidak valid.');
    const version=(old.version??0)+1;tx.update(s.ref,{permissions,status,version,updatedBy:c.uid,updatedAt:serverTimestamp()});if(!isInvite)tx.set(ref(d.studioId,'staffEvents',`${target}_${version}`),{target,actor:c.uid,permissions,status,version,createdAt:serverTimestamp()});return {uid:d.uid,version};
  });
}
export async function claimInvitation(db:Firestore,user:User,studioId:string,invitationId:string,displayName:string){
  const address=email(invitationId),name=text(displayName,2,100,'Nama');await user.reload();await user.getIdToken(true);if(!user.emailVerified||user.email?.toLowerCase()!==address)fail('failed-precondition','Verifikasi email undangan terlebih dahulu.');
  return runTransaction(db,async tx=>{
    const invitation=doc(db,'studios',identifier(studioId),'invitations',address),profile=doc(db,'users',user.uid),member=doc(db,'studios',studioId,'members',user.uid),[i,p,m]=await Promise.all([tx.get(invitation),tx.get(profile),tx.get(member)]);
    if(p.exists()||m.exists()){if(p.get('studioId')===studioId&&m.get('status')==='active'&&i.get('acceptedBy')===user.uid)return;fail('failed-precondition','Akun sudah terikat studio atau undangan lain.');}
    const v=i.data();if(!v||v.status!=='pending'||v.expiresAt.toMillis()<=Date.now())fail('failed-precondition','Undangan tidak tersedia atau kedaluwarsa. Hubungi owner.');
    tx.set(profile,{studioId,email:address,displayName:name,phone:'',jobTitle:'',invitationId:address,version:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    tx.set(member,{role:'staff',status:'active',permissions:v.permissions,email:address,displayName:name,invitationId:address,version:1,invitedBy:v.createdBy,acceptedAt:serverTimestamp(),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:user.uid});
    tx.update(invitation,{status:'accepted',acceptedBy:user.uid,acceptedAt:serverTimestamp(),version:v.version+1,updatedAt:serverTimestamp(),updatedBy:user.uid});
  });
}

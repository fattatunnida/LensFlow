const {test,expect}=require('@playwright/test');
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8082';
const sid='e2e-feedback',uid='e2e-feedback-owner',email='feedback-owner@lensflow.test',password='FeedbackOwner2026!';let admin,db;
const button=(page,name)=>page.getByRole('button',{name,exact:true}),notice=page=>page.getByTestId('app-notification');
async function submit(page,address=email,pass=password){await page.getByRole('textbox',{name:'Email',exact:true}).fill(address);await page.getByRole('textbox',{name:'Kata sandi',exact:true}).fill(pass);await button(page,'Masuk').click();}
test.beforeAll(async()=>{
  admin=initializeApp({projectId:'demo-lensflow'},'e2e-feedback-admin');db=getFirestore(admin);const auth=getAuth(admin);await db.recursiveDelete(db.doc(`studios/${sid}`));
  for(const [id,address]of [[uid,email],['e2e-feedback-unassigned','feedback-unassigned@lensflow.test']]){try{await auth.getUser(id);await auth.updateUser(id,{password});}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid:id,email:address,password});}}
  await db.doc(`users/${uid}`).set({studioId:sid,displayName:'Feedback Owner',email});await db.doc(`users/e2e-feedback-unassigned`).delete();
  await db.doc(`studios/${sid}`).set({name:'Feedback Studio',timezone:'Asia/Jakarta',clientBackendVersion:1});await db.doc(`studios/${sid}/members/${uid}`).set({role:'owner',status:'active',permissions:{booking:true,calendarCrm:true,payments:true,reports:true}});
});
test.afterAll(async()=>{await deleteApp(admin);});

test('auth confirmations reflect valid studio access, survive logout and do not repeat on restore or metadata refresh',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/login');
  await submit(page,email,'WrongPassword2026!');await expect(page.getByRole('alert').filter({hasText:'Email atau kata sandi tidak sesuai'})).toBeVisible();await expect(notice(page)).toHaveCount(0);
  await submit(page,'feedback-unassigned@lensflow.test');await expect(page.getByRole('alert').filter({hasText:'Akun belum memiliki akses aktif'})).toBeVisible();await expect(notice(page).filter({hasText:'Berhasil masuk'})).toHaveCount(0);
  await submit(page);await expect(page.getByRole('tab',{name:'Beranda',exact:true})).toBeVisible();await expect(notice(page).filter({hasText:'Berhasil masuk'})).toBeVisible();await expect(notice(page)).toHaveCount(1);await page.screenshot({path:'test-results/feedback-login.png'});await button(page,'Tutup pemberitahuan').click();
  await page.goto('/settings/profile');const name=page.getByRole('textbox',{name:'Nama pengguna',exact:true});await expect(name).toBeVisible();await name.fill('Unsaved Owner Draft');await db.doc(`users/${uid}`).update({displayName:'Metadata Updated Owner'});await expect(name).toHaveValue('Unsaved Owner Draft');await expect(notice(page)).toHaveCount(0);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(name).toHaveValue('Unsaved Owner Draft');await expect(notice(page)).toHaveCount(0);
  await page.reload();await expect(name).toHaveValue('Metadata Updated Owner');await expect(notice(page)).toHaveCount(0);
  await name.fill('Saved Owner');await button(page,'Simpan profil').click();await expect(notice(page).filter({hasText:'Profil berhasil diperbarui'})).toBeVisible();await button(page,'Tutup pemberitahuan').click();
  await page.goto('/notifications/settings');await expect(page.getByText('Pesan login, logout, dan penyimpanan tampil di aplikasi.',{exact:false})).toBeVisible();
  await page.goto('/more');await button(page,'Keluar dari Akun').click();await button(page,'Ya, keluar').click();await expect(page.getByRole('textbox',{name:'Email',exact:true})).toBeVisible();await expect(notice(page).filter({hasText:'Berhasil keluar'})).toBeVisible();await page.screenshot({path:'test-results/feedback-logout.png'});await button(page,'Tutup pemberitahuan').click();
  await submit(page);await expect(notice(page).filter({hasText:'Berhasil masuk'})).toBeVisible();await button(page,'Tutup pemberitahuan').click();
  await db.doc(`studios/${sid}/members/${uid}`).update({status:'inactive'});await expect(page.getByRole('textbox',{name:'Email',exact:true})).toBeVisible();await expect(notice(page).filter({hasText:'Akses akun berakhir'})).toBeVisible();await expect(notice(page).filter({hasText:'Berhasil keluar'})).toHaveCount(0);
  expect(errors).toEqual([]);
});

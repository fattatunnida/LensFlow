// Local-only worker. It never sends push, email or any external message.
process.env.FIRESTORE_EMULATOR_HOST=process.env.FIRESTORE_EMULATOR_HOST??'127.0.0.1:8082';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST))throw new Error('Worker requires a loopback emulator.');
const functionsRequire=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
const {initializeApp,deleteApp}=functionsRequire('firebase-admin/app'),{getFirestore}=functionsRequire('firebase-admin/firestore'),{dispatch}=require('../functions/overview.cjs');
const args=process.argv.slice(2),scopeIndex=args.indexOf('--studio');
if(args.some((arg,index)=>arg!=='--once'&&arg!=='--studio'&&!(scopeIndex>=0&&index===scopeIndex+1))||scopeIndex>=0&&!/^[A-Za-z0-9_-]{1,128}$/.test(args[scopeIndex+1]??''))throw new Error('Use --once and/or --studio STUDIO_ID.');
const scope=scopeIndex>=0?{studioIds:[args[scopeIndex+1]]}:{};
const app=initializeApp({projectId:'demo-lensflow'},'inbox-local-worker');let stopped=false;
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
(async()=>{try{do{let result;do{result=await dispatch(getFirestore(app),scope);console.log(JSON.stringify(result));}while(result.pending&&!stopped);if(args.includes('--once')||stopped)break;await new Promise(resolve=>setTimeout(resolve,60000));}while(!stopped);}finally{await deleteApp(app);}})().catch(error=>{console.error(error.message);process.exitCode=1;});

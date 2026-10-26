import { firestoreCall } from '../../lib/firestore-api';
import type { Dashboard,InboxCursor,InboxPage,InboxPreferences,InboxTarget } from './models';
export function readDashboard(studioId:string){return firestoreCall<unknown,Dashboard>('dashboardRead',{timeout:30000})({studioId}).then(r=>r.data);}
export function readInbox(studioId:string,next:InboxCursor|null=null){return firestoreCall<unknown,InboxPage>('inboxList',{timeout:40000})({studioId,next}).then(r=>r.data);}
export function openInboxItem(studioId:string,id:string){return firestoreCall<unknown,{target:InboxTarget}>('inboxRead',{timeout:30000})({studioId,id}).then(r=>r.data);}
export function readInboxPreferences(studioId:string){return firestoreCall<unknown,InboxPreferences>('inboxPreferences',{timeout:30000})({studioId}).then(r=>r.data);}
export function saveInboxPreferences(studioId:string,value:Omit<InboxPreferences,'version'>,expectedVersion:number){return firestoreCall<unknown,InboxPreferences>('inboxPreferences',{timeout:30000})({studioId,value,expectedVersion}).then(r=>r.data);}

const pendingClients=new Map<string,string>();
const key=(uid:string,studioId:string)=>JSON.stringify([uid,studioId]);
export function handoffBookingClient(uid:string,studioId:string,id:string){pendingClients.set(key(uid,studioId),id);}
export function peekBookingClient(uid:string,studioId:string){return pendingClients.get(key(uid,studioId));}
export function completeBookingHandoff(uid:string,studioId:string,id:string){const k=key(uid,studioId);if(pendingClients.get(k)===id)pendingClients.delete(k);}
export function clearBookingHandoffs(){pendingClients.clear();}

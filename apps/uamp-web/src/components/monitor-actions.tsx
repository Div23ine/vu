'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDelete,apiPatch } from '../lib/api';
export function MonitorActions({id,status}:{id:string;status:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function toggle(){setBusy(true);setError('');try{await apiPatch(`/api/v1/uamp/monitors/${id}`,{status:status==='active'?'paused':'active'});router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Update failed');}finally{setBusy(false);}}
 async function remove(){if(!window.confirm('Delete this monitor?'))return;setBusy(true);setError('');try{await apiDelete(`/api/v1/uamp/monitors/${id}`);router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Delete failed');}finally{setBusy(false);}}
 return <div className="inline-actions"><button className="small-button" onClick={()=>void toggle()} disabled={busy}>{busy?'Saving…':status==='active'?'Pause':'Activate'}</button><button className="small-button" onClick={()=>void remove()} disabled={busy}>Delete</button>{error&&<span className="form-error">{error}</span>}</div>;
}
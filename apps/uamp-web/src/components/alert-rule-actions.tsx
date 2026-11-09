'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDelete } from '../lib/api';
export function AlertRuleActions({id}:{id:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function remove(){if(!window.confirm('Delete this alert rule?'))return;setBusy(true);setError('');try{await apiDelete(`/api/v1/uamp/alert-rules/${id}`);router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Delete failed');}finally{setBusy(false);}}
 return <div className="inline-actions"><button className="small-button" onClick={()=>void remove()} disabled={busy}>{busy?'Deleting…':'Delete'}</button>{error&&<span className="form-error">{error}</span>}</div>;
}
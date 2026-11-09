'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPatch } from '../lib/api';
export function IncidentActions({id,status}:{id:string;status:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const next=status==='open'?'acknowledged':status==='acknowledged'?'investigating':'resolved';
 if(status==='resolved'||status==='false_positive')return <span className="subtle">Closed</span>;
 async function update(){setBusy(true);setError('');try{await apiPatch(`/api/v1/uamp/incidents/${id}`,{status:next});router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Update failed');}finally{setBusy(false);}}
 return <div className="inline-actions"><button className="small-button" onClick={()=>void update()} disabled={busy}>{busy?'Saving…':next==='resolved'?'Resolve':next==='investigating'?'Investigate':'Acknowledge'}</button>{error&&<span className="form-error">{error}</span>}</div>;
}
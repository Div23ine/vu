'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UampMonitor } from '@vunvault/contracts';
import { apiPost } from '../lib/api';
export function AlertRuleForm({monitors}:{monitors:UampMonitor[]}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [channel,setChannel]=useState('email');const [destination,setDestination]=useState('');const [monitorId,setMonitorId]=useState('');const [threshold,setThreshold]=useState('3');
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');
 try{await apiPost('/api/v1/uamp/alert-rules',{channel,destination:destination.trim(),failureThreshold:Number(threshold),...(monitorId?{monitorId}:{})});setDestination('');router.refresh();}
 catch(cause){setError(cause instanceof Error?cause.message:'Could not create alert rule.');}finally{setBusy(false);}}
 return <form onSubmit={submit}><div className="form-grid"><div className="field"><label htmlFor="alert-channel">Channel</label><select id="alert-channel" value={channel} onChange={e=>setChannel(e.target.value)}><option value="email">Email</option><option value="slack">Slack</option><option value="webhook">Webhook</option><option value="in_app">In-app</option></select></div><div className="field"><label htmlFor="alert-destination">Destination</label><input id="alert-destination" required maxLength={2048} value={destination} onChange={e=>setDestination(e.target.value)} placeholder={channel==='email'?'ops@example.com':'https://…'}/></div><div className="field"><label htmlFor="alert-monitor">Monitor scope</label><select id="alert-monitor" value={monitorId} onChange={e=>setMonitorId(e.target.value)}><option value="">All monitors</option>{monitors.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div><div className="field"><label htmlFor="alert-threshold">Failure threshold</label><input id="alert-threshold" type="number" min="1" max="20" value={threshold} onChange={e=>setThreshold(e.target.value)}/></div></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button-primary" disabled={busy}>{busy?'Saving…':'Create alert rule'}</button></div></form>;
}
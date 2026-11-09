'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../lib/api';
const TYPES=['http','https','api','ssl','domain','dns','keyword'] as const;
export function MonitorForm(){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [form,setForm]=useState({name:'',type:'https',target:'',method:'GET',intervalSeconds:'300',timeoutMs:'10000',keyword:''});
 function update(key:string,value:string){setForm(current=>({...current,[key]:value}));}
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');
 try{await apiPost('/api/v1/uamp/monitors',{name:form.name.trim(),type:form.type,target:form.target.trim(),...(['http','https','api'].includes(form.type)?{method:form.method}:{}),intervalSeconds:Number(form.intervalSeconds),timeoutMs:Number(form.timeoutMs),...(form.type==='keyword'&&form.keyword.trim()?{keyword:form.keyword.trim()}:{})});router.push('/monitors');router.refresh();}
 catch(cause){setError(cause instanceof Error?cause.message:'Monitor could not be created.');}finally{setBusy(false);}}
 return <form onSubmit={submit}><div className="form-grid">
 <div className="field"><label htmlFor="monitor-name">Monitor name</label><input id="monitor-name" required maxLength={120} placeholder="Production website" value={form.name} onChange={e=>update('name',e.target.value)}/></div>
 <div className="field"><label htmlFor="monitor-type">Monitor type</label><select id="monitor-type" value={form.type} onChange={e=>update('type',e.target.value)}>{TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
 <div className="field field-wide"><label htmlFor="monitor-target">Target URL or hostname</label><input id="monitor-target" required maxLength={2048} placeholder="https://example.com" value={form.target} onChange={e=>update('target',e.target.value)}/><span className="field-hint">Use a public hostname or URL. Private, loopback and internal targets are rejected by the monitoring service.</span></div>
 {['http','https','api'].includes(form.type)&&<div className="field"><label htmlFor="monitor-method">HTTP method</label><select id="monitor-method" value={form.method} onChange={e=>update('method',e.target.value)}>{['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].map(m=><option key={m}>{m}</option>)}</select></div>}
 {form.type==='keyword'&&<div className="field"><label htmlFor="monitor-keyword">Expected keyword</label><input id="monitor-keyword" required value={form.keyword} onChange={e=>update('keyword',e.target.value)} placeholder="Expected page text"/></div>}
 <div className="field"><label htmlFor="monitor-interval">Check interval (seconds)</label><input id="monitor-interval" type="number" min="30" max="86400" required value={form.intervalSeconds} onChange={e=>update('intervalSeconds',e.target.value)}/></div>
 <div className="field"><label htmlFor="monitor-timeout">Timeout (milliseconds)</label><input id="monitor-timeout" type="number" min="1000" max="60000" required value={form.timeoutMs} onChange={e=>update('timeoutMs',e.target.value)}/></div>
 </div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button-primary" disabled={busy}>{busy?'Creating…':'Create monitor'}</button></div></form>;
}
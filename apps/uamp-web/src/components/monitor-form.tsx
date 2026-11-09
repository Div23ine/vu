'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../lib/api';
const TYPES=['http','https','api','ssl','domain','dns','keyword'] as const;
export function MonitorForm(){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [form,setForm]=useState({name:'',type:'https',target:'',method:'GET',intervalSeconds:'300',timeoutMs:'10000',keyword:'',requestBody:'',headers:'',expectedStatusCodes:'200',bodyContains:'',maxLatencyMs:'',locations:'',warnDaysBeforeExpiry:'30'});
 function update(key:string,value:string){setForm(current=>({...current,[key]:value}));}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const headers=form.headers.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const i=line.indexOf(':');return i>0?{name:line.slice(0,i).trim(),value:line.slice(i+1).trim()}:null;});
  if(headers.some(h=>h===null)){setError('Each request header must use the format Name: value.');setBusy(false);return;}
  const codes=form.expectedStatusCodes.split(',').map(v=>v.trim()).filter(Boolean).map(Number);
  if(codes.some(v=>!Number.isInteger(v)||v<100||v>599)){setError('Expected status codes must be comma-separated HTTP status codes.');setBusy(false);return;}
  const assertions:Record<string,unknown>={};
  if(codes.length)assertions.expectedStatusCodes=codes;
  if(form.bodyContains.trim())assertions.bodyContains=form.bodyContains.trim();
  if(form.maxLatencyMs.trim())assertions.maxLatencyMs=Number(form.maxLatencyMs);
  try{
   await apiPost('/api/v1/uamp/monitors',{
    name:form.name.trim(),type:form.type,target:form.target.trim(),
    ...(['http','https','api'].includes(form.type)?{method:form.method}:{}),
    intervalSeconds:Number(form.intervalSeconds),timeoutMs:Number(form.timeoutMs),
    ...(form.type==='keyword'&&form.keyword.trim()?{keyword:form.keyword.trim()}:{}),
    ...(form.requestBody.trim()?{requestBody:form.requestBody}:{}),
    ...(headers.length?{headers}:{}),
    ...(Object.keys(assertions).length?{assertions}:{}),
    ...(form.locations.trim()?{locations:form.locations.split(',').map(v=>v.trim()).filter(Boolean)}:{}),
    ...(['ssl','domain'].includes(form.type)?{warnDaysBeforeExpiry:Number(form.warnDaysBeforeExpiry)}:{})
   });
   router.push('/monitors');router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:'Monitor could not be created.');}
  finally{setBusy(false);}
 }
 const http=['http','https','api'].includes(form.type);
 return <form onSubmit={submit}>
  <div className="form-grid">
   <div className="field"><label htmlFor="monitor-name">Monitor name</label><input id="monitor-name" required maxLength={120} placeholder="Production website" value={form.name} onChange={e=>update('name',e.target.value)}/></div>
   <div className="field"><label htmlFor="monitor-type">Monitor type</label><select id="monitor-type" value={form.type} onChange={e=>update('type',e.target.value)}>{TYPES.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
   <div className="field field-wide"><label htmlFor="monitor-target">Target URL or hostname</label><input id="monitor-target" required maxLength={2048} placeholder="https://example.com" value={form.target} onChange={e=>update('target',e.target.value)}/><span className="field-hint">Use a public hostname or URL. Private, loopback and internal targets are rejected by the monitoring service.</span></div>
   {http&&<div className="field"><label htmlFor="monitor-method">HTTP method</label><select id="monitor-method" value={form.method} onChange={e=>update('method',e.target.value)}>{['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].map(m=><option key={m}>{m}</option>)}</select></div>}
   {form.type==='keyword'&&<div className="field"><label htmlFor="monitor-keyword">Expected keyword</label><input id="monitor-keyword" required value={form.keyword} onChange={e=>update('keyword',e.target.value)} placeholder="Expected page text"/></div>}
   <div className="field"><label htmlFor="monitor-interval">Check interval (seconds)</label><input id="monitor-interval" type="number" min="30" max="86400" required value={form.intervalSeconds} onChange={e=>update('intervalSeconds',e.target.value)}/></div>
   <div className="field"><label htmlFor="monitor-timeout">Timeout (milliseconds)</label><input id="monitor-timeout" type="number" min="1000" max="60000" required value={form.timeoutMs} onChange={e=>update('timeoutMs',e.target.value)}/></div>
   {['ssl','domain'].includes(form.type)&&<div className="field"><label htmlFor="monitor-warn-days">Expiry warning (days)</label><input id="monitor-warn-days" type="number" min="1" max="90" value={form.warnDaysBeforeExpiry} onChange={e=>update('warnDaysBeforeExpiry',e.target.value)}/></div>}
   <div className="field field-wide"><label htmlFor="monitor-locations">Check locations (optional)</label><input id="monitor-locations" value={form.locations} onChange={e=>update('locations',e.target.value)} placeholder="eu-west, us-east"/><span className="field-hint">Comma-separated location identifiers supported by your monitoring deployment.</span></div>
  </div>
  {http&&<details style={{marginTop:22}}><summary style={{cursor:'pointer',color:'#9fc7f7',fontSize:12,fontWeight:700}}>Advanced HTTP and API checks</summary>
   <div className="form-grid" style={{marginTop:16}}>
    <div className="field field-wide"><label htmlFor="monitor-headers">Request headers</label><textarea id="monitor-headers" value={form.headers} onChange={e=>update('headers',e.target.value)} placeholder={'Accept: application/json\nX-Environment: production'}/><span className="field-hint">One header per line. Avoid pasting long-lived secrets into shared workspaces.</span></div>
    <div className="field field-wide"><label htmlFor="monitor-body">Request body (optional)</label><textarea id="monitor-body" value={form.requestBody} onChange={e=>update('requestBody',e.target.value)} placeholder='{"ping":true}'/></div>
    <div className="field"><label htmlFor="monitor-codes">Expected status codes</label><input id="monitor-codes" value={form.expectedStatusCodes} onChange={e=>update('expectedStatusCodes',e.target.value)} placeholder="200, 204"/></div>
    <div className="field"><label htmlFor="monitor-latency">Maximum latency (ms)</label><input id="monitor-latency" type="number" min="1" max="60000" value={form.maxLatencyMs} onChange={e=>update('maxLatencyMs',e.target.value)} placeholder="1500"/></div>
    <div className="field field-wide"><label htmlFor="monitor-contains">Response body must contain</label><input id="monitor-contains" value={form.bodyContains} onChange={e=>update('bodyContains',e.target.value)} placeholder="healthy"/></div>
   </div>
  </details>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="form-actions"><button className="button button-primary" disabled={busy}>{busy?'Creating…':'Create monitor'}</button></div>
 </form>;
}
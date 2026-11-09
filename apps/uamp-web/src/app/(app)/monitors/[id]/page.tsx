import Link from 'next/link';
import type { UampCheckResult,UampMonitor } from '@vunvault/contracts';
import { getUamp } from '../../../../lib/server-api';
interface Props{params:Promise<{id:string}>}
export default async function MonitorDetailPage({params}:Props){
 const {id}=await params;
 const [monitor,checks]=await Promise.all([
  getUamp<{data:UampMonitor}>(`/api/v1/uamp/monitors/${id}`),
  getUamp<{data:UampCheckResult[];total:number}>(`/api/v1/uamp/check-results?page=1&pageSize=50&monitorId=${encodeURIComponent(id)}`)
 ]);
 const m=monitor.data;
 return <><div className="page-head"><div><p className="eyebrow">MONITOR DETAIL</p><h1>{m.name}</h1><p>{m.target}</p></div><Link className="button button-secondary" href="/monitors">← All monitors</Link></div>
 <section className="metric-grid"><Metric label="Current state" value={m.lastStatus??m.status}/><Metric label="Response time" value={m.lastLatencyMs==null?'—':`${m.lastLatencyMs} ms`}/><Metric label="Check interval" value={`${m.intervalSeconds}s`}/><Metric label="Monitor type" value={m.type.toUpperCase()}/></section>
 <section className="panel"><h2>Configuration</h2><div className="form-grid" style={{marginTop:18}}><Info label="Target" value={m.target}/><Info label="Type" value={m.type}/><Info label="Method" value={m.method??'—'}/><Info label="Timeout" value={`${m.timeoutMs} ms`}/><Info label="Created" value={new Date(m.createdAt).toLocaleString()}/><Info label="Last checked" value={m.lastCheckedAt?new Date(m.lastCheckedAt).toLocaleString():'Not checked yet'}/></div></section>
 <section className="panel"><div className="panel-head"><div><h2>Recent check results</h2><p className="panel-sub">{checks.total} check records</p></div></div>{checks.data.length?<div className="table-wrap"><table><thead><tr><th>Result</th><th>HTTP status</th><th>Latency</th><th>Location</th><th>Checked at</th><th>Details</th></tr></thead><tbody>{checks.data.map(c=><tr key={c.id}><td><span className={`status status-${c.status}`}>{c.status}</span></td><td>{c.httpStatus??'—'}</td><td>{c.latencyMs==null?'—':`${c.latencyMs} ms`}</td><td>{c.location??'—'}</td><td>{new Date(c.checkedAt).toLocaleString()}</td><td className="subtle">{c.errorMessage??c.responseSnippet??'—'}</td></tr>)}</tbody></table></div>:<div className="empty-state">No checks have been recorded for this monitor yet.</div>}</section>
 </>;
}
function Metric({label,value}:{label:string;value:string}){return <article className="metric-card"><div className="metric-label">{label}</div><div className="metric-value" style={{fontSize:22}}>{value}</div></article>}
function Info({label,value}:{label:string;value:string}){return <div className="field"><label>{label}</label><div style={{fontSize:12,overflowWrap:'anywhere'}}>{value}</div></div>}
import Link from 'next/link';
import type { UampMonitor, UampIncident, UampCheckResult } from '@vunvault/contracts';
import { getUamp, listPath } from '../../../lib/server-api';
type List<T> = { data: T[]; total: number };
export default async function DashboardPage() {
 const [monitors,incidents,checks]=await Promise.all([getUamp<List<UampMonitor>>(listPath('monitors')),getUamp<List<UampIncident>>(listPath('incidents')),getUamp<List<UampCheckResult>>(listPath('check-results'))]);
 const active=monitors.data.filter(x=>x.status==='active').length;
 const up=monitors.data.filter(x=>x.lastStatus==='up').length;
 const open=incidents.data.filter(x=>!['resolved','false_positive'].includes(x.status)).length;
 const availability=String(up);
 return <>
 <div className="page-head"><div><p className="eyebrow">RELIABILITY OVERVIEW</p><h1>Your uptime, at a glance.</h1><p>Services, checks and active incidents in one operational view.</p></div><Link className="button button-primary" href="/monitors/new">＋ Add monitor</Link></div>
 <section className="metric-grid"><Metric label="Total monitors" value={String(monitors.total)} foot={`${active} active monitors`}/><Metric label="Monitors reporting up" value={availability} foot="Latest successful check state"/><Metric label="Open incidents" value={String(open)} foot="Events requiring attention"/><Metric label="Recent checks" value={String(checks.total)} foot="Latest results returned by the API"/></section>
 <section className="panel"><div className="panel-head"><div><h2>Monitors</h2><p className="panel-sub">Latest monitor state from the UAMP API</p></div><Link className="text-link" href="/monitors">View all →</Link></div>
 {monitors.data.length?<div className="table-wrap"><table><thead><tr><th>Monitor</th><th>Type</th><th>State</th><th>Response</th><th>Last checked</th></tr></thead><tbody>{monitors.data.slice(0,8).map(m=><tr key={m.id}><td><strong>{m.name}</strong><div className="subtle">{m.target}</div></td><td>{m.type.toUpperCase()}</td><td><span className={`status status-${m.lastStatus??m.status}`}>{m.lastStatus??m.status}</span></td><td>{m.lastLatencyMs==null?'—':`${m.lastLatencyMs} ms`}</td><td>{m.lastCheckedAt?new Date(m.lastCheckedAt).toLocaleString():'Not checked yet'}</td></tr>)}</tbody></table></div>:<div className="empty-state">No monitors yet. Add your first website or API endpoint.</div>}</section>
 <section className="panel"><div className="panel-head"><div><h2>Recent incidents</h2><p className="panel-sub">Open reliability events and their current status</p></div><Link className="text-link" href="/incidents">Incident history →</Link></div>
 {incidents.data.length?<div className="table-wrap"><table><thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Started</th></tr></thead><tbody>{incidents.data.slice(0,6).map(i=><tr key={i.id}><td><strong>{i.title}</strong><div className="subtle">{i.failureCount} failed checks</div></td><td><span className={`status status-${i.severity}`}>{i.severity}</span></td><td><span className={`status status-${i.status}`}>{i.status.replace('_',' ')}</span></td><td>{new Date(i.startedAt).toLocaleString()}</td></tr>)}</tbody></table></div>:<div className="empty-state">No incidents recorded for this workspace.</div>}</section>
 </>;
}
function Metric({label,value,foot}:{label:string;value:string;foot:string}){return <article className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></article>}
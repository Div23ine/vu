import Link from 'next/link';
import type { UampMonitor } from '@vunvault/contracts';
import { getUamp, listPath } from '../../../lib/server-api';
import { MonitorActions } from '../../../components/monitor-actions';
export default async function MonitorsPage(){
 const result=await getUamp<{data:UampMonitor[];total:number}>(listPath('monitors'));
 return <><div className="page-head"><div><p className="eyebrow">SERVICE INVENTORY</p><h1>Monitors</h1><p>Manage websites, APIs, certificates, domains and DNS checks.</p></div><Link className="button button-primary" href="/monitors/new">＋ Add monitor</Link></div>
 <section className="panel"><div className="panel-head"><div><h2>All monitors</h2><p className="panel-sub">{result.total} monitor records</p></div></div>
 {result.data.length?<div className="table-wrap"><table><thead><tr><th>Name / target</th><th>Type</th><th>Status</th><th>Interval</th><th>Latency</th><th>Last check</th><th>Actions</th></tr></thead><tbody>{result.data.map(m=><tr key={m.id}><td><Link href={`/monitors/${m.id}`}><strong>{m.name}</strong></Link><div className="subtle">{m.target}</div></td><td>{m.type.toUpperCase()}</td><td><span className={`status status-${m.lastStatus??m.status}`}>{m.lastStatus??m.status}</span></td><td>{m.intervalSeconds}s</td><td>{m.lastLatencyMs==null?'—':`${m.lastLatencyMs} ms`}</td><td>{m.lastCheckedAt?new Date(m.lastCheckedAt).toLocaleString():'Pending'}</td><td><MonitorActions id={m.id} status={m.status}/></td></tr>)}</tbody></table></div>:<div className="empty-state">You have not added a monitor yet.</div>}</section></>;
}
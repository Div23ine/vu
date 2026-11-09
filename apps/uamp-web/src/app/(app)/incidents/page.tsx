import type { UampIncident } from '@vunvault/contracts';
import { getUamp, listPath } from '../../../lib/server-api';
import { IncidentActions } from '../../../components/incident-actions';
export default async function IncidentsPage(){
 const result=await getUamp<{data:UampIncident[];total:number}>(listPath('incidents'));
 return <><div className="page-head"><div><p className="eyebrow">EVENT RESPONSE</p><h1>Incidents</h1><p>Review, acknowledge and resolve service interruptions.</p></div></div><section className="panel"><div className="panel-head"><div><h2>Incident history</h2><p className="panel-sub">{result.total} incidents returned</p></div></div>
 {result.data.length?<div className="table-wrap"><table><thead><tr><th>Incident</th><th>Severity</th><th>Status</th><th>Failures</th><th>Started</th><th>Actions</th></tr></thead><tbody>{result.data.map(i=><tr key={i.id}><td><strong>{i.title}</strong><div className="subtle">{i.summary??i.monitorId}</div></td><td><span className={`status status-${i.severity}`}>{i.severity}</span></td><td><span className={`status status-${i.status}`}>{i.status.replace('_',' ')}</span></td><td>{i.failureCount}</td><td>{new Date(i.startedAt).toLocaleString()}</td><td><IncidentActions id={i.id} status={i.status}/></td></tr>)}</tbody></table></div>:<div className="empty-state">No incidents have been recorded for this workspace.</div>}</section></>;
}
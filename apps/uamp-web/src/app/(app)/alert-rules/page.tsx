import type { UampAlertRule,UampMonitor } from '@vunvault/contracts';
import { getUamp,listPath } from '../../../lib/server-api';
import { AlertRuleForm } from '../../../components/alert-rule-form';
import { AlertRuleActions } from '../../../components/alert-rule-actions';
export default async function AlertRulesPage(){
 const [rules,monitors]=await Promise.all([getUamp<{data:UampAlertRule[];total:number}>(listPath('alert-rules')),getUamp<{data:UampMonitor[];total:number}>(listPath('monitors'))]);
 return <><div className="page-head"><div><p className="eyebrow">NOTIFICATION ROUTING</p><h1>Alert rules</h1><p>Choose where UAMP sends notifications when a monitor fails.</p></div></div>
 <section className="panel"><div className="panel-head"><div><h2>Configured destinations</h2><p className="panel-sub">{rules.total} alert rules</p></div></div>
 {rules.data.length?<div className="table-wrap"><table><thead><tr><th>Channel</th><th>Destination</th><th>Monitor</th><th>Threshold</th><th>Enabled</th><th>Actions</th></tr></thead><tbody>{rules.data.map(r=><tr key={r.id}><td>{r.channel.replace('_',' ')}</td><td>{r.destination}</td><td>{monitors.data.find(m=>m.id===r.monitorId)?.name??'All monitors'}</td><td>{r.failureThreshold} failures</td><td><span className={r.enabled?'status status-active':'status status-paused'}>{r.enabled?'Enabled':'Disabled'}</span></td><td><AlertRuleActions id={r.id}/></td></tr>)}</tbody></table></div>:<div className="empty-state">No alert rules configured yet.</div>}</section>
 <section className="panel"><div className="panel-head"><div><h2>Add an alert rule</h2><p className="panel-sub">Connect email, Slack or a webhook endpoint.</p></div></div><AlertRuleForm monitors={monitors.data}/></section></>;
}
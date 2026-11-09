import type { UampStatusPage } from '@vunvault/contracts';
import { getUamp, listPath } from '../../../lib/server-api';
import { StatusPageForm } from '../../../components/status-page-form';
export default async function StatusPagesPage(){
 const result=await getUamp<{data:UampStatusPage[];total:number}>(listPath('status-pages'));
 return <><div className="page-head"><div><p className="eyebrow">CUSTOMER COMMUNICATIONS</p><h1>Status pages</h1><p>Create public or private service-status pages for customers.</p></div></div>
 <section className="panel"><div className="panel-head"><div><h2>Your status pages</h2><p className="panel-sub">{result.total} status pages</p></div></div>
 {result.data.length?<div className="table-wrap"><table><thead><tr><th>Name</th><th>Slug</th><th>Visibility</th><th>Monitors</th><th>State</th></tr></thead><tbody>{result.data.map(p=><tr key={p.id}><td><strong>{p.name}</strong><div className="subtle">{p.headline??'No headline configured'}</div></td><td>/{p.slug}</td><td>{p.visibility}</td><td>{p.monitorIds.length}</td><td><span className={p.isActive?'status status-active':'status status-paused'}>{p.isActive?'Active':'Inactive'}</span></td></tr>)}</tbody></table></div>:<div className="empty-state">No status pages created yet.</div>}</section>
 <section className="panel"><div className="panel-head"><div><h2>Create a status page</h2><p className="panel-sub">Choose a unique URL slug and visibility.</p></div></div><StatusPageForm/></section></>;
}
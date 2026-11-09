'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../lib/api';
export function StatusPageForm(){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [name,setName]=useState('');const [slug,setSlug]=useState('');const [visibility,setVisibility]=useState('public');const [headline,setHeadline]=useState('');
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');
 try{await apiPost('/api/v1/uamp/status-pages',{name:name.trim(),slug:slug.trim().toLowerCase(),visibility,...(headline.trim()?{headline:headline.trim()}:{})});setName('');setSlug('');setHeadline('');router.refresh();}
 catch(cause){setError(cause instanceof Error?cause.message:'Could not create status page.');}finally{setBusy(false);}}
 return <form onSubmit={submit}><div className="form-grid"><div className="field"><label htmlFor="sp-name">Page name</label><input id="sp-name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Acme service status"/></div><div className="field"><label htmlFor="sp-slug">URL slug</label><input id="sp-slug" required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="acme-status"/></div><div className="field"><label htmlFor="sp-visibility">Visibility</label><select id="sp-visibility" value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">Public</option><option value="private">Private</option></select></div><div className="field"><label htmlFor="sp-headline">Headline (optional)</label><input id="sp-headline" maxLength={200} value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="All systems operational"/></div></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button button-primary" disabled={busy}>{busy?'Creating…':'Create status page'}</button></div></form>;
}
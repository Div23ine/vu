import type { Metadata } from 'next';
import { requireSession } from '../../../lib/server-session';
import { getUampDashboardData } from '../../../lib/uamp-server';

export const metadata: Metadata = { title: 'Incidents', robots: { index: false, follow: false } };

export default async function IncidentsPage() {
  await requireSession('uamp:read');
  const data = await getUampDashboardData();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1728]">
      <div className="border-b border-slate-800 px-5 py-4">
        <h1 className="text-xl font-semibold text-white">Incidents</h1>
        <p className="mt-1 text-xs text-slate-500">{data.incidentTotal} incident records in this workspace</p>
      </div>
      {data.incidents.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">No incidents recorded.</p>
      ) : (
        <div className="divide-y divide-slate-800">
          {data.incidents.map((incident) => (
            <article key={incident.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 className="font-medium text-white">{incident.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{incident.startedAt ? new Date(incident.startedAt).toISOString() : 'Date unavailable'}</p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">{incident.severity}</span>
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">{incident.status}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

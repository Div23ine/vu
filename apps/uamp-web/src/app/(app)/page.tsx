import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '../../lib/server-session';
import { getUampDashboardData, type UampDashboardData } from '../../lib/uamp-server';

export const metadata: Metadata = {
  title: 'Reliability overview',
  robots: { index: false, follow: false }
};

function pretty(value: string | null | undefined): string {
  if (!value) return 'No data';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function when(value: string | null | undefined): string {
  if (!value) return 'No check recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) + ' UTC';
}

function tone(status: string | null | undefined): string {
  if (status === 'up' || status === 'resolved') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'degraded') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (status === 'down' || status === 'timeout' || status === 'error') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  return 'border-slate-700 bg-slate-800 text-slate-300';
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0e1728] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Dashboard({ data, canManage }: { data: UampDashboardData; canManage: boolean }) {
  const healthy = data.monitors.filter((item) => item.lastStatus === 'up').length;
  const degraded = data.monitors.filter((item) => item.lastStatus === 'degraded').length;
  const down = data.monitors.filter((item) => ['down', 'timeout', 'error'].includes(item.lastStatus ?? '')).length;
  const open = data.incidents.filter((item) => ['open', 'acknowledged', 'investigating'].includes(item.status)).length;

  return (
    <>
      <section className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Reliability monitoring</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">System overview</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Monitor and incident data from your VUNVAULT workspace. Monitoring runs independently of the AI investigation service.
        </p>
      </section>
      <section aria-label="Monitoring summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total monitors" value={data.monitorTotal} detail="All monitors in this workspace" />
        <Metric label="Healthy" value={healthy} detail="Healthy in the latest 100 monitor records" />
        <Metric label="Needs attention" value={degraded + down} detail={degraded + ' degraded · ' + down + ' down / timed out / errored'} />
        <Metric label="Open incidents" value={open} detail={'From ' + data.incidentTotal + ' incident records'} />
      </section>
      <section id="monitors" className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1728]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">Monitors</h2>
            <p className="mt-1 text-xs text-slate-500">Latest check status and response time</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{data.monitors.length} records loaded</span>
            {canManage && <Link href="/monitors/new" className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">Add monitor</Link>}
          </div>
        </div>
        {data.monitors.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-200">No monitors yet</p>
            <p className="mt-2 text-sm text-slate-500">Create your first monitor to start tracking availability.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Monitor</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Last result</th>
                  <th className="px-5 py-3 font-medium">Response</th>
                  <th className="px-5 py-3 font-medium">Last checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.monitors.map((monitor) => (
                  <tr key={monitor.id} className="text-slate-300">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{monitor.name}</p>
                      <p className="mt-1 max-w-[360px] truncate text-xs text-slate-500">{monitor.target}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{monitor.type.toUpperCase()}</td>
                    <td className="px-5 py-4">
                      <span className={'inline-flex rounded-full border px-2.5 py-1 text-xs ' + tone(monitor.lastStatus)}>{pretty(monitor.lastStatus)}</span>
                      <p className="mt-1 text-[11px] text-slate-500">{pretty(monitor.status)}</p>
                    </td>
                    <td className="px-5 py-4 tabular-nums">{monitor.lastLatencyMs == null ? '—' : monitor.lastLatencyMs + ' ms'}</td>
                    <td className="px-5 py-4 text-xs text-slate-400">{when(monitor.lastCheckedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section id="incidents" className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1728]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">Recent incidents</h2>
            <p className="mt-1 text-xs text-slate-500">Incident history from this workspace</p>
          </div>
          <Link href="/incidents" className="text-xs font-medium text-cyan-300 hover:text-cyan-200">View incidents</Link>
        </div>
        {data.incidents.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No incidents recorded.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {data.incidents.slice(0, 10).map((incident) => (
              <div key={incident.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium text-white">{incident.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{when(incident.startedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{pretty(incident.severity)}</span>
                  <span className={'rounded-full border px-2.5 py-1 text-xs ' + tone(incident.status === 'resolved' ? 'resolved' : 'down')}>{pretty(incident.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default async function UampDashboardPage() {
  const session = await requireSession('uamp:read');
  let data: UampDashboardData;
  try {
    data = await getUampDashboardData();
  } catch (error) {
    const message = error instanceof Error && error.message === 'uamp_access_denied'
      ? 'Your account does not have access to UAMP HQ data.'
      : 'UAMP data is temporarily unavailable. Please refresh or contact your workspace administrator.';
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
        <h1 className="text-xl font-semibold text-white">Unable to load UAMP HQ</h1>
        <p className="mt-2 text-sm text-rose-200">{message}</p>
      </div>
    );
  }
  const canManage = session.permissions.includes('uamp:manage');
  return <Dashboard data={data} canManage={canManage} />;
}

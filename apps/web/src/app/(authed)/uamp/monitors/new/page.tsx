import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '../../../../../lib/server-session';
import { NewMonitorForm } from '../../new-monitor-form';

export const metadata: Metadata = {
  title: 'Create monitor — UAMP HQ',
  robots: { index: false, follow: false },
};

export default async function NewUampMonitorPage() {
  await requireSession({ permission: 'uamp:manage' });

  return (
    <section className="mx-auto max-w-3xl">
      <Link href="/uamp#monitors" className="text-sm text-cyan-300 hover:text-cyan-200">← Back to overview</Link>
      <div className="mb-7 mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Monitor setup</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Create a monitor</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Configure an uptime, API, DNS, TLS or domain-expiry check for your workspace.</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-[#0e1728] p-5 sm:p-7">
        <NewMonitorForm />
      </div>
    </section>
  );
}

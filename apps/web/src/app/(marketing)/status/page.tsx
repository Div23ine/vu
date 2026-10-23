import type { Metadata } from 'next';
import { env } from '../../../env';

export const metadata: Metadata = {
  title: 'Status',
  description: 'Live availability of the VUNVAULT API, database and exchange-rate feed.',
};

interface Probe {
  name: string;
  ok: boolean;
  detail: string;
}

async function probe(name: string, url: string, expectJson: boolean): Promise<Probe> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return { name, ok: false, detail: `HTTP ${response.status}` };
    if (expectJson) {
      const body = (await response.json()) as Record<string, unknown>;
      return { name, ok: true, detail: String(body.status ?? 'ok') };
    }
    return { name, ok: true, detail: 'reachable' };
  } catch {
    return { name, ok: false, detail: 'unreachable' };
  }
}

export default async function StatusPage() {
  const [api, db, fx] = await Promise.all([
    probe('Public API', `${env.NEXT_PUBLIC_API_URL}/healthz`, false),
    probe('Database', `${env.NEXT_PUBLIC_API_URL}/readyz`, true),
    probe('Exchange-rate feed', `${env.NEXT_PUBLIC_API_URL}/api/v1/fx-rates`, true),
  ]);
  const probes = [api, db, fx];

  return (
    <section className="py-14 md:py-20 bg-paper">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8">
        <header className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Status</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            Service status
          </h1>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed max-w-2xl">
            Live probes, checked when this page renders. Retainer monitoring runs on the same
            checks, on a schedule, with paging.
          </p>
        </header>
        <ul className="space-y-3">
          {probes.map((item) => (
            <li
              key={item.name}
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-5 py-4"
            >
              <span className="text-sm font-bold text-neutral-900">{item.name}</span>
              <span
                className={`text-xs font-extrabold uppercase tracking-wider ${
                  item.ok ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {item.ok ? `Operational · ${item.detail}` : `Degraded · ${item.detail}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-500">
          Checked at {new Date().toISOString()} · this page never caches.
        </p>
      </div>
    </section>
  );
}

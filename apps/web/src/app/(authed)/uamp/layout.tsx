import Link from 'next/link';
import { requireSession } from '../../../lib/server-session';

const NAV = [
  { label: 'Overview', href: '/uamp' },
  { label: 'Monitors', href: '/uamp#monitors' },
  { label: 'Incidents', href: '/uamp#incidents' },
] as const;

export default async function UampLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession({ permission: 'uamp:read' });

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0e1728]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-4">
          <Link href="/uamp" className="flex items-center gap-3" aria-label="UAMP HQ dashboard">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-slate-950">
              U
            </span>
            <span>
              <span className="block text-lg font-bold tracking-wide">UAMP HQ</span>
              <span className="block text-xs text-slate-400">by VUNVAULT</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-400 sm:inline">{session.email}</span>
            <Link href="/portal" className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-800">
              VUNVAULT portal
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-800 bg-[#0e1728] p-3">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>
          <nav aria-label="UAMP HQ navigation" className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

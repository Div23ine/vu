import Link from 'next/link';
import { env } from '../../env';
import { requireSession } from '../../lib/server-session';

const NAV = [
  { label: 'Overview', href: '/' },
  { label: 'Incidents', href: '/incidents' },
  { label: 'Add monitor', href: '/monitors/new', permission: 'uamp:manage' as const }
];

export default async function UampAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession('uamp:read');

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0e1728]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="UAMP HQ overview">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-slate-950">U</span>
            <span>
              <span className="block text-lg font-bold tracking-wide text-white">UAMP HQ</span>
              <span className="block text-xs text-slate-400">by VUNVAULT</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-400 sm:inline">{session.email}</span>
            <a href={env.NEXT_PUBLIC_AUTH_URL + '/portal'} className="rounded-lg border border-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-800">
              VUNVAULT portal
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-800 bg-[#0e1728] p-3">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
          <nav aria-label="UAMP HQ navigation" className="space-y-1">
            {NAV.filter((item) => !('permission' in item) || session.permissions.includes(item.permission)).map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white">
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

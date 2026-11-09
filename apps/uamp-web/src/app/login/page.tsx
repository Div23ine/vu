import Link from 'next/link';
import { env } from '../../env';

export const metadata = {
  title: 'Sign in to UAMP HQ',
  robots: { index: false, follow: false }
};

export default function UampLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0e1728] p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950">U</span>
          <div>
            <p className="text-lg font-bold text-white">UAMP HQ</p>
            <p className="text-xs text-slate-400">by VUNVAULT</p>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Sign in to your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          UAMP HQ uses your existing VUNVAULT account. Sign in through the secure VUNVAULT account portal in a new tab, then return here and refresh this page. Your session cookie is shared across the approved VUNVAULT subdomains.
        </p>
        <a
          href={env.NEXT_PUBLIC_AUTH_URL + '/login'}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
        >
          Open VUNVAULT sign-in
        </a>
        <p className="mt-4 text-center text-xs text-slate-500">
          <Link href="/" className="text-cyan-300 hover:text-cyan-200">Return to UAMP HQ</Link>
        </p>
      </section>
    </main>
  );
}

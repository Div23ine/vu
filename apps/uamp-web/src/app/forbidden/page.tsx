import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <section className="max-w-lg rounded-2xl border border-rose-500/30 bg-[#0e1728] p-8">
        <h1 className="text-2xl font-bold text-white">UAMP HQ access required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Your VUNVAULT account does not have the UAMP HQ permission required for this page. Ask your workspace administrator to grant access.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
          Back to overview
        </Link>
      </section>
    </main>
  );
}

'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useJoinWaitlist } from '../_hooks/use-join-waitlist';

/**
 * Coming-soon banner — when a visitor hits a route that does not exist, the
 * 404 surface redirects them home with `?coming-soon=<path>` (and `&tool=<id>`
 * when the path matches an open tool). This banner explains that the page is
 * on the way and offers the waitlist: one email input, no account, no noise.
 */

function BannerInner() {
  const params = useSearchParams();
  const path = params.get('coming-soon');
  const tool = params.get('tool');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const join = useJoinWaitlist();

  if (path === null || path === '') return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    join.mutate(
      { email, topic: tool ?? '' },
      {
        onSuccess: () => setStatus('done'),
        onError: () => setStatus('error'),
      },
    );
  }

  return (
    <section
      aria-label="Coming soon"
      className="border-b border-cyan-200/70 bg-cyan-50/70 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Coming soon</p>
        <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
          <code className="font-mono text-base sm:text-lg">{path}</code> is still on the way
        </h2>
        <p className="text-sm leading-relaxed text-neutral-600">
          We took you back to the landing page because that page is not live yet. Join the waitlist
          and you will be the first to know when it opens
          {tool === null || tool === '' ? '' : ` — including early access to ${tool}`}.
        </p>
        {status === 'done' ? (
          <p role="status" className="text-sm font-semibold text-emerald-700">
            You are on the list — we will email you the moment it goes live.
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <label className="sr-only" htmlFor="waitlist-email">
              Email address
            </label>
            <input
              id="waitlist-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-cyan-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={join.isPending}
              className="rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:opacity-60"
            >
              {join.isPending ? 'Joining…' : 'Join the waitlist'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p role="alert" className="text-sm font-semibold text-rose-700">
            That did not go through — please try again.
          </p>
        )}
      </div>
    </section>
  );
}

export function ComingSoonBanner() {
  return (
    <Suspense fallback={null}>
      <BannerInner />
    </Suspense>
  );
}

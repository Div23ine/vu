'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { Skeleton } from '@vunvault/ui';
import type { PublicContentItem } from '@vunvault/contracts';
import { usePublicContent } from '../../_hooks/use-public-content';
import { ArticleCard } from '../article-card';
import '../../_styles/home-mid.css';

/**
 * Latest Insights & Intelligence (Task 49) — the rotating 3-up news grid.
 *
 * Data: `usePublicContent({ pageSize: 6, sort: "newest" })`. While more than
 * three posts exist the visible window advances one position every 4000 ms
 * (round-robin), re-entering with the `is-news-entering` animation staggered
 * 70 ms per card. Rotation pauses on hover and on focus-within so nobody
 * reads a card that is about to leave, and never runs under
 * `prefers-reduced-motion`.
 */

const ROTATION_INTERVAL_MS = 4000;
const VISIBLE_COUNT = 3;
const STAGGER_MS = 70;

function prefersReducedMotion(): boolean {
  // Defensive shape (jsdom ships no matchMedia): no matchMedia → animate.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function InsightsGrid() {
  const { data, isLoading } = usePublicContent({ pageSize: 6, sort: 'newest' });
  const items = useMemo(() => data ?? [], [data]);

  const [offset, setOffset] = useState(0);
  const [rotations, setRotations] = useState(0);
  const [paused, setPaused] = useState(false);

  const rotates = items.length > VISIBLE_COUNT;

  useEffect(() => {
    if (!rotates || paused || prefersReducedMotion()) return;
    const timer = setInterval(() => {
      setOffset((value) => (value + 1) % items.length);
      setRotations((count) => count + 1);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [rotates, paused, items.length]);

  const visible: PublicContentItem[] = [];
  const count = Math.min(VISIBLE_COUNT, items.length);
  for (let position = 0; position < count; position += 1) {
    const item = items[(offset + position) % items.length];
    if (item !== undefined) visible.push(item);
  }

  return (
    <section className="py-12 md:py-16 bg-paper border-y border-neutral-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
              <Newspaper size={14} aria-hidden="true" />
              Latest Insights &amp; Intelligence
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              From the VUNVAULT News &amp; Blog
            </h2>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors group"
          >
            <span>Explore all news &amp; reports</span>
            <ArrowRight
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <div
          id="vv-news-grid"
          className="vv-news-grid"
          aria-live="polite"
          aria-busy={isLoading}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {isLoading ? (
            [0, 1, 2].map((slot) => <Skeleton key={slot} className="h-[380px] rounded-lg" />)
          ) : visible.length === 0 ? (
            <p className="text-sm text-ink-muted">No published reports yet.</p>
          ) : (
            visible.map((item, position) => (
              <ArticleCard
                key={`${rotations}:${item.id}`}
                item={item}
                index={position}
                entering={rotations > 0}
                enterDelayMs={position * STAGGER_MS}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { cn } from '@vunvault/lib';
import '../_styles/about.css';

/**
 * About hero (Task 53) — headline, dual CTAs and the four-stat strip.
 *
 * This file also hosts the page's tiny scroll-reveal hook: the deliverables
 * list no separate hook file, and the hero's stat strip is the first
 * `vv-reveal` consumer.
 *
 * `useReveal()` semantics (per the catalogue):
 *  - the server markup carries NO hidden state — without JS the content is
 *    visible immediately;
 *  - on the client (before first paint) elements arm into `.vv-reveal` and an
 *    IntersectionObserver adds `.is-in` when they scroll into view;
 *  - under `prefers-reduced-motion` (or without IntersectionObserver, e.g.
 *    jsdom) nothing arms: the content is simply visible. (The stylesheet's
 *    reduced-motion block independently forces `.vv-reveal` visible, so both
 *    layers agree.)
 */

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReveal<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  className: string;
} {
  const ref = useRef<T>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;

    setArmed(true);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const className = !armed ? '' : shown ? 'vv-reveal is-in' : 'vv-reveal';
  return { ref, className };
}

const HERO_STATS = [
  { value: '412', label: 'Sensors Online' },
  { value: '1,284', label: 'Assets Monitored' },
  { value: '12,904', label: 'Threats Blocked' },
  { value: '1.2s', label: 'Mean Patch Time' },
] as const;

export function AboutHero() {
  const reveal = useReveal<HTMLDivElement>();

  return (
    <section className="vv-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 vv-hero-inner">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <span className="hero-eyebrow">Africa-rooted · Worldwide defense</span>
          <h1 className="vv-h1">We were built where the internet is hardest to defend.</h1>
          <p className="vv-lead max-w-3xl mx-auto">
            VUNVAULT is a Nairobi-headquartered offensive security firm. We run adversary emulation,
            penetration testing and continuous attack-surface mapping for SACCOs, fintechs, M-Pesa
            gateway providers and enterprises — teams whose uptime is measured in livelihoods, not
            service credits.
          </p>
          <div className="vv-hero-actions">
            <Link href="/services" className="btn-get-started">
              Explore Our Services
            </Link>
            <Link href="/contact" className="vv-btn-ghost">
              <MessageCircle size={16} aria-hidden="true" />
              <span>Talk to an Engineer</span>
            </Link>
          </div>
        </div>

        <div ref={reveal.ref} className={cn('vv-stat-strip', reveal.className)}>
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="vv-stat">
              <span className="vv-stat-value">{stat.value}</span>
              <span className="vv-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

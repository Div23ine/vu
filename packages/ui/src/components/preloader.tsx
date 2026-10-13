/* eslint-disable @next/next/no-img-element -- `@vunvault/ui` is framework-free:
 * the brand mark is a static operator asset served from `apps/web/public`, so
 * `next/image` is deliberately not used here. */

'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import { useEffect, useRef, useState } from 'react';
import { cn } from '@vunvault/lib';

export interface PreloaderProps {
  /** How long the sequence plays before it starts to fade. Default 4000ms. */
  durationMs?: number;
  /** Called once, after the panel has fully unmounted. */
  onDone?: () => void;
  /** Operator-supplied mark, served from `/brand/logo.svg`. */
  src?: string;
}

const LOGO_SRC = '/brand/logo.svg';
/** Length of the `opacity` fade defined on `.vv-preloader`. */
const FADE_OUT_MS = 700;
/** Under reduced motion the whole sequence collapses to this duration. */
const REDUCED_MOTION_MS = 800;

/** SSR-safe reduced-motion probe. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Full-screen brand preloader: the mark floats inside three orbital rings over a
 * drifting grid, the wordmark and caption fade up, and the progress bar sweeps.
 *
 * Lifecycle: `durationMs` → add `is-hidden` (0.6s fade) → 700ms later unmount and
 * call `onDone`. Reduced motion shortens the sequence to 800ms and the CSS block
 * in `preloader.css` stops every animation while keeping the final state.
 */
export function Preloader({ durationMs = 4000, onDone, src = LOGO_SRC }: PreloaderProps) {
  const [hidden, setHidden] = useState(false);
  const [present, setPresent] = useState(true);

  // Keep the latest callback without restarting the timers on every render.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const visibleMs = prefersReducedMotion() ? REDUCED_MOTION_MS : durationMs;
    const hideTimer = setTimeout(() => setHidden(true), visibleMs);
    const finishTimer = setTimeout(() => {
      setPresent(false);
      onDoneRef.current?.();
    }, visibleMs + FADE_OUT_MS);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs]);

  if (!present) return null;

  return (
    <div
      className={cn('vv-preloader', hidden && 'is-hidden')}
      role="status"
      aria-live="polite"
      aria-label="Loading VUNVAULT"
    >
      <div className="vv-preloader__inner">
        <div className="vv-preloader__mark">
          <div className="vv-preloader__stage" aria-hidden="true">
            <span className="vv-preloader__ring vv-preloader__ring--1" />
            <span className="vv-preloader__ring vv-preloader__ring--2" />
            <span className="vv-preloader__ring vv-preloader__ring--3" />
            <span className="vv-preloader__halo" />
          </div>
          <img className="vv-preloader__logo" src={src} alt="VUNVAULT Logo" />
        </div>
        <div className="vv-preloader__wordmark">VUNVAULT</div>
        <div
          className="vv-preloader__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={100}
          aria-label="Page loading progress"
        >
          <span className="vv-preloader__fill" />
        </div>
        <span className="vv-preloader__caption">Establishing secure channel</span>
      </div>
    </div>
  );
}

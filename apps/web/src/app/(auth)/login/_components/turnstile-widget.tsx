'use client';

import { useEffect, useRef } from 'react';

/**
 * Minimal Cloudflare Turnstile widget (Phase 4).
 *
 * Rendered ONLY when the magic-link endpoint answers `captchaRequired: true`
 * (the per-IP abuse soft limit with server-side enforcement on) — the login
 * card stays widget-free for everybody else, so the Cloudflare script is
 * loaded lazily at that point and never on a normal sign-in.
 *
 * The site key is `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; without it (or if the
 * script fails) `onError` fires and the card shows its "try again later"
 * copy — the SERVER still fails closed, so this is a UX signal, not a gate.
 */

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
    };
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export interface TurnstileWidgetProps {
  /** Fired with the solved token — the caller re-submits the form with it. */
  onVerify: (token: string) => void;
  /** Fired when the widget cannot run (no site key, script or render error). */
  onError?: () => void;
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  // Keep the latest callbacks without re-running the loader effect.
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

    const fail = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      onErrorRef.current?.();
    };

    const mount = () => {
      if (settledRef.current) return;
      const element = containerRef.current;
      if (element === null || window.turnstile === undefined) {
        fail();
        return;
      }
      settledRef.current = true;
      try {
        window.turnstile.render(element, {
          sitekey: siteKey,
          callback: (token: string) => onVerifyRef.current(token),
          'error-callback': () => onErrorRef.current?.(),
        });
      } catch {
        onErrorRef.current?.();
      }
    };

    if (siteKey === '' && window.turnstile === undefined) {
      fail();
      return undefined;
    }
    if (window.turnstile !== undefined) {
      mount();
      return undefined;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = mount;
    script.onerror = fail;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return <div className="vv-turnstile" id="vvTurnstile" ref={containerRef} />;
}

export default TurnstileWidget;

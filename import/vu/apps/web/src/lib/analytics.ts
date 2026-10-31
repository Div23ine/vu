'use client';

import type { AnalyticsBody, AnalyticsEvent } from '@vunvault/contracts';
import { useConsentStore } from '../app/(marketing)/_components/consent/consent-store';

/**
 * Consent-gated first-party analytics. Nothing leaves the browser unless the
 * visitor accepted the Analytics category; the payload is an event name and
 * minimal meta — no cookies, no IP, no fingerprint. Fire-and-forget: a
 * failing beacon must never break a purchase.
 */
export function track(event: AnalyticsEvent, meta?: AnalyticsBody['meta']): void {
  if (typeof window === 'undefined') return;
  const { decided, prefs } = useConsentStore.getState();
  if (!decided || !prefs.analytics) return;
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/analytics`;
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, meta }),
    keepalive: true,
  }).catch(() => undefined);
}

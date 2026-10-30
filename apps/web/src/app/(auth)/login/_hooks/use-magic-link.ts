'use client';

import { useCallback, useState } from 'react';
import { z } from 'zod';
import { isApiError } from '@vunvault/lib';
import type { MagicLinkRequestResponse } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';
import { safeNextPath } from '../_lib/next-path';

/**
 * Magic-link request hook (Phase 1, hardened in Phase 4) — the ONLY sign-in
 * credential is an email address; no route, hook or component in the login
 * surface accepts a password.
 *
 * The API answers every request with the identical generic 200 body
 * (`MAGIC_LINK_ACK_MESSAGE`) whether or not the address is registered, so the
 * hook never branches on registration status: success always advances the UI
 * to the "Check your email" state. Failures are limited to transport errors
 * and rate limiting — both surfaced as inline copy, never as a toast that
 * could hint at account state.
 *
 * Phase 4 adds the bot-defence carriage: every request carries the honeypot
 * field value (`website`, empty for humans) and `formTs` (epoch ms of this
 * hook's mount = form render, the timing signal). When the API answers
 * `captchaRequired: true` (per-IP soft limit, enforcement on) the hook enters
 * the `captcha` phase instead of `sent`; the card renders Turnstile and
 * re-submits with the token via `request(email, { captchaToken })`.
 */

export type MagicLinkPhase = 'idle' | 'submitting' | 'sent' | 'captcha';

const RequestEmailSchema = z.string().min(1).email();

export interface MagicLinkRequestExtra {
  /** Honeypot field value — anything non-empty is a bot (server drops it). */
  website?: string;
  /** Turnstile token, sent when retrying a `captchaRequired` response. */
  captchaToken?: string;
}

export interface UseMagicLinkResult {
  phase: MagicLinkPhase;
  /** Inline error copy for the request leg (transport / 429), or null. */
  error: string | null;
  /**
   * Destination captured at request time (sanitised `?next=`, else null).
   * It rides inside the emailed verify URL, so the post-MFA landing can
   * continue where the visitor was headed.
   */
  next: string | null;
  request: (email: string, extra?: MagicLinkRequestExtra) => Promise<boolean>;
  /** "Use a different email" / captcha cancel — back to the form, error cleared. */
  reset: () => void;
}

export function useMagicLink(): UseMagicLinkResult {
  const [phase, setPhase] = useState<MagicLinkPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  // Epoch ms of form render — the server's timing signal (Phase 4).
  const [formTs] = useState(() => Date.now());

  const request = useCallback(
    async (email: string, extra: MagicLinkRequestExtra = {}): Promise<boolean> => {
      const check = RequestEmailSchema.safeParse(email.trim());
      if (!check.success) {
        setError('Enter a valid email address.');
        return false;
      }
      setError(null);
      setPhase('submitting');

      // Capture the destination at request time: the verify leg runs from an
      // opaque emailed link and must not depend on this tab's query string.
      let nextPath: string | null = null;
      try {
        nextPath = safeNextPath(new URLSearchParams(window.location.search).get('next'));
      } catch {
        nextPath = null;
      }

      try {
        const body = await apiPost<MagicLinkRequestResponse>('/api/v1/auth/magic-link', {
          email: check.data.trim(),
          website: extra.website ?? '',
          formTs,
          ...(nextPath !== null ? { next: nextPath } : {}),
          ...(extra.captchaToken !== undefined ? { captchaToken: extra.captchaToken } : {}),
        });
        if (body.captchaRequired === true) {
          // Per-IP soft limit: prove humanity, then the card re-submits.
          setPhase('captcha');
          return false;
        }
        setNext(nextPath);
        setPhase('sent');
        return true;
      } catch (cause) {
        // A failed RESEND must not throw the visitor back to the form: the
        // "Check your email" state stays, with the error shown inline.
        setPhase((current) => (current === 'sent' ? 'sent' : 'idle'));
        if (isApiError(cause) && cause.status === 429) {
          setError('Too many requests. Please wait a few minutes before trying again.');
        } else {
          setError('Could not send the sign-in link. Please try again.');
        }
        return false;
      }
    },
    [formTs],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  return { phase, error, next, request, reset };
}

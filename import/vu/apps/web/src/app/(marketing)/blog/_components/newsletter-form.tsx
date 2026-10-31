'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { NewsletterSubscribeBody } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { useNewsletterSubscribe } from '../_hooks/use-blog';
import '../_styles/blog.css';

/**
 * Newsletter signup — RHF + Zod over `NewsletterSubscribeBody`.
 *
 * A `202` answers with the authored toast (`Check your inbox` /
 * `We sent a confirmation link to your email address.`) and clears the field;
 * the endpoint — and therefore this form — never reveals whether the address
 * already existed. The double opt-in completes on `/newsletter/confirm`
 * . Failures colour the fine print `is-err` with the API's own
 * message.
 */

const DEFAULT_NOTE = 'No spam. Unsubscribe anytime. We only send threat intelligence.';

type NewsletterFormValues = NewsletterSubscribeBody;

export function NewsletterForm() {
  const subscribe = useNewsletterSubscribe();
  const [noteState, setNoteState] = useState<'default' | 'ok' | 'err'>('default');
  const [noteText, setNoteText] = useState<string>(DEFAULT_NOTE);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterFormValues>({
    resolver: zodResolver(NewsletterSubscribeBody),
    defaultValues: { email: '', source: 'blog' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await subscribe.mutateAsync(values);
      setNoteState('ok');
      setNoteText(DEFAULT_NOTE);
      toast({
        kind: 'ok',
        title: 'Check your inbox',
        message: 'We sent a confirmation link to your email address.',
      });
      reset();
    } catch (error) {
      setNoteState('err');
      setNoteText(
        isApiError(error) ? (error.message ?? error.code) : 'The signup could not be sent.',
      );
    }
  });

  return (
    <section className="vv-newsletter-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vv-newsletter">
          <div className="vv-newsletter-glow" aria-hidden="true" />
          <div className="vv-newsletter-body">
            <span className="vv-newsletter-eyebrow">Threat Advisory Newsletter</span>
            <h2 className="vv-newsletter-title">
              Get zero-day briefings before the exploit drops.
            </h2>
            <p className="vv-newsletter-text">
              Weekly context on weaponised CVEs, patch windows and adversary tradecraft — plus the
              sensor data behind each call. Written by the analysts who publish our advisories.
            </p>
          </div>

          <form
            className="vv-newsletter-form"
            id="vv-newsletter-form"
            onSubmit={onSubmit}
            noValidate
          >
            <label className="sr-only" htmlFor="vv-newsletter-email">
              Email address
            </label>
            <input
              id="vv-newsletter-email"
              className="vv-newsletter-input"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              aria-invalid={errors.email !== undefined}
              {...register('email')}
            />
            <button type="submit" className="vv-newsletter-btn" disabled={subscribe.isPending}>
              Subscribe
            </button>
          </form>

          <p
            className={cn(
              'vv-newsletter-note',
              noteState === 'ok' && 'is-ok',
              noteState === 'err' && 'is-err',
            )}
            id="vv-newsletter-note"
            role={noteState === 'err' ? 'alert' : undefined}
          >
            {errors.email !== undefined ? (errors.email.message ?? noteText) : noteText}
          </p>
        </div>
      </div>
    </section>
  );
}

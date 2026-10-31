'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { z } from 'zod';
import { CONTACT_CATEGORY_LABELS, ContactBody, type ContactCategory } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { Spinner } from '@vunvault/ui';
import { contactReference, useSubmitContact, type ContactPayload } from '../_hooks/use-contact';
import '../_styles/contact.css';

/**
 * Secure request form — RHF + Zod over the contract's `ContactBody`.
 *
 * The design queued submissions in `localStorage`; this posts to the public
 * contact API and shows the reference banner instead:
 * - `201` → ok banner `Request received — reference REQ-XXXXXX.` plus the
 * category-specific sentence, then a form reset;
 * - `400 validation_failed` / `429` / network failure → the authored
 * alert banners, verbatim below.
 *
 * The hidden `website` honeypot rides along in the payload (the API answers
 * 201 and silently drops anything where it is filled — a bot gets the same
 * banner a human would). The category preselects from `?category=<enum
 * value>` (the press band's `Request a Report` link uses it).
 */

const contactFormSchema = ContactBody.extend({
  /** Client-only honeypot; the API's bot field, mirrored for parity. */
  website: z.string().max(200).optional(),
});

/**
 * The form's working types differ from the schema's output: the select starts
 * empty (`''`) and the checkbox starts `false` — states the validated payload
 * can never have. The resolver bridges them; at `onSubmit` the values are
 * schema-valid by construction.
 */
interface ContactFormValues {
  name: string;
  email: string;
  organization: string;
  category: ContactCategory | '';
  subject: string;
  message: string;
  consent: boolean;
  website: string;
}

const CATEGORY_OPTIONS = Object.entries(CONTACT_CATEGORY_LABELS) as [ContactCategory, string][];
const CATEGORY_VALUES = new Set<string>(CATEGORY_OPTIONS.map(([value]) => value));

/**
 * Per-category success sentences. The reference JS is truncated after the
 * journalist and whistleblower entries, and its localStorage-queue wording is
 * replaced per the spec's instruction ("An administrator will review it
 * shortly."); the remaining categories fall back to that sentence.
 */
const CATEGORY_SUCCESS: Partial<Record<ContactCategory, string>> = {
  journalist_blogger_profile_request:
    'Your Journalist / Blogger profile request is submitted for manual verification. An administrator will review it shortly.',
  whistleblower_tip:
    'Your tip is routed to the confidential disclosure team. Encrypt follow-up correspondence with our public PGP key. An administrator will review it shortly.',
};
const DEFAULT_SUCCESS = 'An administrator will review it shortly.';

const VALIDATION_BANNER =
  'Please complete every required field with a valid business email address before sending.';
const RATE_LIMIT_BANNER = 'Too many requests. Please wait a few minutes and try again.';
const NETWORK_BANNER = 'We could not send your request. Please email support@vunvault.com instead.';

type BannerState =
  { kind: 'ok'; reference: string; detail: string } | { kind: 'err'; text: string };

export function ContactForm() {
  const searchParams = useSearchParams();
  const submitContact = useSubmitContact();
  const [banner, setBanner] = useState<BannerState | null>(null);

  const requestedCategory = searchParams.get('category') ?? '';
  const initialCategory: ContactCategory | '' = CATEGORY_VALUES.has(requestedCategory)
    ? (requestedCategory as ContactCategory)
    : '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema) as unknown as Resolver<ContactFormValues>,
    defaultValues: {
      name: '',
      email: '',
      organization: '',
      category: initialCategory,
      subject: '',
      message: '',
      consent: false,
      website: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const category = values.category as ContactCategory;
    const payload: ContactPayload = {
      name: values.name,
      email: values.email,
      organization: values.organization === '' ? undefined : values.organization,
      category,
      subject: values.subject,
      message: values.message,
      // The resolver only lets schema-valid values through, so consent is `true` here.
      consent: values.consent as true,
      website: values.website,
    };
    try {
      const id = await submitContact.mutateAsync(payload);
      setBanner({
        kind: 'ok',
        reference: contactReference(id),
        detail: CATEGORY_SUCCESS[category] ?? DEFAULT_SUCCESS,
      });
      reset();
    } catch (error) {
      if (isApiError(error) && error.status === 400 && error.code === 'validation_failed') {
        setBanner({ kind: 'err', text: VALIDATION_BANNER });
      } else if (isApiError(error) && error.status === 429) {
        setBanner({ kind: 'err', text: RATE_LIMIT_BANNER });
      } else if (!isApiError(error)) {
        setBanner({ kind: 'err', text: NETWORK_BANNER });
      } else {
        setBanner({ kind: 'err', text: error.message ?? error.code });
      }
    }
  });

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
          Secure Request Form
        </span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
        Tell us what you need
      </h2>
      <p className="mt-3 text-sm text-neutral-500 leading-relaxed max-w-xl">
        Every submission is encrypted in transit and routed to the correct team. Journalist and
        blogger requests go through manual verification before any publishing rights are granted.
      </p>

      <form id="contact-form" className="mt-7 space-y-5" onSubmit={onSubmit} noValidate>
        <div className="vv-form-row">
          <div className="vv-field">
            <label className="zero-day-label" htmlFor="cf-name">
              Full Name <span aria-hidden="true">*</span>
            </label>
            <input
              className={cn('zero-day-input', errors.name !== undefined && 'is-invalid')}
              id="cf-name"
              type="text"
              autoComplete="name"
              placeholder="Jane Wanjiru"
              aria-invalid={errors.name !== undefined}
              {...register('name')}
            />
          </div>

          <div className="vv-field">
            <label className="zero-day-label" htmlFor="cf-email">
              Business Email <span aria-hidden="true">*</span>
            </label>
            <input
              className={cn('zero-day-input', errors.email !== undefined && 'is-invalid')}
              id="cf-email"
              type="email"
              autoComplete="email"
              placeholder="jane@company.co.ke"
              aria-invalid={errors.email !== undefined}
              {...register('email')}
            />
          </div>

          <div className="vv-field">
            <label className="zero-day-label" htmlFor="cf-org">
              Organization
            </label>
            <input
              className="zero-day-input"
              id="cf-org"
              type="text"
              autoComplete="organization"
              placeholder="Company, SACCO or newsroom"
              {...register('organization')}
            />
          </div>

          <div className="vv-field">
            <label className="zero-day-label" htmlFor="cf-category">
              Inquiry Category <span aria-hidden="true">*</span>
            </label>
            <select
              className={cn('zero-day-input', errors.category !== undefined && 'is-invalid')}
              id="cf-category"
              aria-invalid={errors.category !== undefined}
              {...register('category')}
            >
              <option value="">Select a category…</option>
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="vv-field vv-field--full">
            <label className="zero-day-label" htmlFor="cf-subject">
              Subject
            </label>
            <input
              className={cn('zero-day-input', errors.subject !== undefined && 'is-invalid')}
              id="cf-subject"
              type="text"
              placeholder="Short summary of your request"
              aria-invalid={errors.subject !== undefined}
              {...register('subject')}
            />
          </div>

          <div className="vv-field vv-field--full">
            <label className="zero-day-label" htmlFor="cf-message">
              Message Details <span aria-hidden="true">*</span>
            </label>
            <textarea
              className={cn('zero-day-input', errors.message !== undefined && 'is-invalid')}
              id="cf-message"
              placeholder="Scope, target environments, deadlines, or the details of your disclosure…"
              aria-invalid={errors.message !== undefined}
              {...register('message')}
            />
          </div>
        </div>

        {errors.consent !== undefined ? (
          <p className="vv-field-error" role="alert">
            {errors.consent.message}
          </p>
        ) : null}
        <label className="vv-check" htmlFor="cf-consent">
          <input
            type="checkbox"
            id="cf-consent"
            aria-invalid={errors.consent !== undefined}
            {...register('consent')}
          />
          <span>
            I confirm I am authorised to submit this request and I accept the VUNVAULT privacy
            policy and responsible disclosure terms.
          </span>
        </label>

        {/* Honeypot: never visible, never focusable, sent as-is (see header). */}
        <div className="vv-hp" aria-hidden="true">
          <label htmlFor="cf-website">Website</label>
          <input
            id="cf-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register('website')}
          />
        </div>

        <div className="vv-form-note" role="note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>
              Every submission is queued locally and reviewed in User &amp; Access Management.
            </strong>{' '}
            Journalist / Blogger profile requests go through manual verification before any
            publishing rights are granted.
          </span>
        </div>

        <div className="vv-form-actions">
          <button
            type="submit"
            className="btn-get-started vv-submit"
            id="cf-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner size="sm" aria-hidden="true" /> : null}
            Send Secure Request
          </button>
          <span className="text-[11px] text-neutral-500 font-mono">
            TLS 1.3 · Nothing is stored on this device
          </span>
        </div>

        <div
          className={cn(
            'vv-status',
            banner !== null && 'is-visible',
            banner !== null && `vv-status--${banner.kind}`,
          )}
          id="cf-status"
          role={banner?.kind === 'err' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {banner !== null ? (
            <>
              {banner.kind === 'ok' ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <AlertCircle size={16} aria-hidden="true" />
              )}
              <span>
                {banner.kind === 'ok' ? (
                  <>
                    Request received — reference <strong>{banner.reference}</strong>.{' '}
                    {banner.detail}
                  </>
                ) : (
                  banner.text
                )}
              </span>
            </>
          ) : null}
        </div>
      </form>
    </div>
  );
}

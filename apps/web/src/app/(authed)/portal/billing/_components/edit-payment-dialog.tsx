'use client';

import { useEffect, useRef, useState } from 'react';
import { Elements, useElements, useStripe, CardNumberElement } from '@stripe/react-stripe-js';
import { Check, X } from 'lucide-react';
import type { PaymentMethodView } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { getStripe, stripeKeyConfigured } from '../../../../../lib/stripe';
import { useUpdatePaymentMethod } from '../_hooks/use-billing';
import { StripeCardFields, type CardFieldsComplete } from './stripe-card-fields';

/**
 * Edit Payment Method dialog .
 *
 * The REQUIRED CHANGE over the design: Card Number / Expiry / CVC are
 * Stripe-hosted Elements (`stripe-card-fields.tsx`) — raw card data never
 * reaches VUNVAULT. Submit tokenises in the browser
 * (`stripe.createPaymentMethod`) and PUTs ONLY the PaymentMethod token plus
 * the holder name and billing country (`UpdatePaymentMethodBody`).
 *
 * Cardholder Name and Billing Country stay normal fields; the country options
 * are the design's verbatim ten (mapped to ISO codes, `Other` → `XX`).
 * Without `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` the dialog shows the spec's
 * `Card updates are temporarily unavailable.` and disables Save.
 *
 * Dialog semantics per the spec: `role="dialog"`, `aria-modal`,
 * `aria-labelledby="vbb-payment-title"`, Tab focus trap, Escape closes.
 *
 * v1 scope: stored methods are Stripe-only; Paystack (M-Pesa, African cards,
 * bank) is per-invoice at checkout .
 */

/** Verbatim option list from the design, mapped to ISO 3166-1 alpha-2. */
export const BILLING_COUNTRIES = [
  { code: 'KE', label: 'Kenya' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'GH', label: 'Ghana' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'UG', label: 'Uganda' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'RW', label: 'Rwanda' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'XX', label: 'Other' },
] as const;

const INCOMPLETE_FIELDS = 'Please complete all card fields';
const REJECTED_FALLBACK = 'The card was rejected. Please check the details and try again.';

export interface EditPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  /** The stored method (its holder/country prefill the form); null = first add. */
  method: PaymentMethodView | null;
}

interface PaymentFormProps {
  method: PaymentMethodView | null;
  onCancel: () => void;
  onDone: () => void;
}

function PaymentForm({ method, onCancel, onDone }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const update = useUpdatePaymentMethod();
  const [holder, setHolder] = useState(method?.cardholderName ?? '');
  const [country, setCountry] = useState(method?.billingCountry ?? 'KE');
  const [complete, setComplete] = useState<CardFieldsComplete>({
    number: false,
    expiry: false,
    cvc: false,
  });
  const [fieldsInvalid, setFieldsInvalid] = useState(false);
  const [formError, setFormError] = useState('');

  const pending = update.isPending;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || stripe === null || elements === null) return;
    if (!complete.number || !complete.expiry || !complete.cvc) {
      setFieldsInvalid(true);
      setFormError(INCOMPLETE_FIELDS);
      return;
    }
    setFormError('');
    setFieldsInvalid(false);

    const cardNumber = elements.getElement(CardNumberElement);
    if (cardNumber === null) {
      setFormError(INCOMPLETE_FIELDS);
      return;
    }
    const result = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
      billing_details: { name: holder.trim(), address: { country } },
    });
    if (result.error !== undefined) {
      // Stripe's own message, inline under the fields (spec).
      setFormError(result.error.message ?? INCOMPLETE_FIELDS);
      return;
    }
    const token = result.paymentMethod?.id;
    if (token === undefined) {
      setFormError(REJECTED_FALLBACK);
      return;
    }
    try {
      await update.mutateAsync({
        provider: 'stripe',
        providerPaymentMethodToken: token,
        cardholderName: holder.trim(),
        billingCountry: country,
      });
    } catch (submitError) {
      if (isApiError(submitError) && submitError.status === 422) {
        setFormError(submitError.message ?? REJECTED_FALLBACK);
        return;
      }
      // Authored fallback (the spec pinned copy for the success toast and
      // Stripe errors only), following the auth family's pattern.
      setFormError(REJECTED_FALLBACK);
      return;
    }
    toast({
      kind: 'ok',
      title: 'Payment method updated',
      message: 'Changes take effect on your next billing cycle.',
    });
    onDone();
  };

  return (
    <form id="vbb-payment-form" onSubmit={(event) => void onSubmit(event)}>
      <div className="vbb-grid-form">
        <div className="vbb-field vbb-col-span-2">
          <label htmlFor="pm-holder">Cardholder Name</label>
          <input
            id="pm-holder"
            name="holder"
            className="vbb-input"
            type="text"
            value={holder}
            autoComplete="cc-name"
            required
            minLength={2}
            onChange={(event) => setHolder(event.target.value)}
          />
        </div>

        <StripeCardFields onChange={setComplete} invalid={fieldsInvalid} />

        <div className="vbb-field vbb-col-span-2">
          <label htmlFor="pm-country">Billing Country</label>
          <select
            id="pm-country"
            name="country"
            className="vbb-select"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            {BILLING_COUNTRIES.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {formError !== '' ? (
        <p className="vbb-field-error" id="vbb-payment-error" role="alert" aria-live="polite">
          {formError}
        </p>
      ) : null}

      <div className="vbb-modal-actions">
        <p className="vbb-modal-note">
          Your card is tokenised immediately — VUNVAULT never stores raw card numbers.
        </p>
        <button type="button" className="vbb-btn vbb-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="vbb-btn vbb-btn--primary"
          id="vbb-payment-save"
          disabled={pending}
          aria-busy={pending}
        >
          <Check size={14} aria-hidden="true" />
          <span>Save Card</span>
        </button>
      </div>
    </form>
  );
}

export function EditPaymentDialog({ open, onClose, method }: EditPaymentDialogProps) {
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const configured = stripeKeyConfigured();

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    lastFocused.current = document.activeElement as HTMLElement | null;
    setMounted(true);
    const focusTimer = setTimeout(() => {
      cardRef.current
        ?.querySelector<HTMLElement>(
          'input, select, button, [href], [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    }, 60);
    return () => clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (open) return;
    lastFocused.current?.focus();
    lastFocused.current = null;
  }, [open]);

  // Escape closes; Tab cycles inside the card; the dialog-level Cancel button
  // (rendered inside the form) closes through the data attribute hook.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || cardRef.current === null) return;
      const focusables = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={cn('vbb-modal', mounted && 'is-open')} id="editPaymentModal">
      <div className="vbb-modal-backdrop" aria-hidden="true" />
      <div
        className="vbb-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vbb-payment-title"
        ref={cardRef}
      >
        <div className="vbb-modal-head">
          <div>
            <span className="vbb-eyebrow">Secure card update</span>
            <h2 id="vbb-payment-title" className="vbb-modal-title">
              Edit Payment Method
            </h2>
            <p className="vbb-modal-text">
              Update the card used for your Enterprise retainer and one-off engagements. Changes
              take effect on your next billing cycle.
            </p>
          </div>
          <button
            type="button"
            className="vbb-modal-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {configured ? (
          <Elements stripe={getStripe()}>
            <PaymentForm method={method} onCancel={onClose} onDone={onClose} />
          </Elements>
        ) : (
          <div className="vbb-modal-actions">
            <p className="vbb-modal-unavailable" role="status">
              Card updates are temporarily unavailable.
            </p>
            <button type="button" className="vbb-btn vbb-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="vbb-btn vbb-btn--primary"
              id="vbb-payment-save"
              disabled
            >
              <Check size={14} aria-hidden="true" />
              <span>Save Card</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

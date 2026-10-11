'use client';

import { useRef } from 'react';
import { CardCvcElement, CardExpiryElement, CardNumberElement } from '@stripe/react-stripe-js';
import { cn } from '@vunvault/lib';
import { tokens } from '@vunvault/ui';

/**
 * Stripe Elements card fields (Task 66) — the REQUIRED CHANGE over the
 * prototype: the raw Card Number / Expiry / CVC inputs are replaced by
 * Stripe-hosted Elements, so card data is tokenised in the browser and NEVER
 * touches VUNVAULT (the API only ever receives a PaymentMethod token).
 *
 * Styled to match `.vbb-input` via the wrapper class; the Element's own
 * inline style uses the token colours read from `tokens` (`@vunvault/ui`) —
 * no hex literal appears in this file. Must render inside `<Elements>`.
 *
 * `onChange` reports per-field completeness so the dialog can gate Save and
 * surface the prototype's `Please complete all card fields` inline.
 */

export interface CardFieldsComplete {
  number: boolean;
  expiry: boolean;
  cvc: boolean;
}

export interface StripeCardFieldsProps {
  onChange: (complete: CardFieldsComplete) => void;
  /** Tints all three wrappers invalid (the incomplete-submit state). */
  invalid?: boolean;
}

const ELEMENT_OPTIONS = {
  style: {
    base: {
      color: tokens.color.ink,
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: '0.84rem',
      fontSmoothing: 'antialiased' as const,
      '::placeholder': { color: tokens.color.inkFaint },
    },
    invalid: { color: tokens.color.critical },
  },
};

export function StripeCardFields({ onChange, invalid = false }: StripeCardFieldsProps) {
  const complete = useRef<CardFieldsComplete>({ number: false, expiry: false, cvc: false });

  const handle =
    (field: keyof CardFieldsComplete) =>
    (event: { complete?: boolean | undefined }): void => {
      complete.current = { ...complete.current, [field]: event.complete === true };
      onChange(complete.current);
    };

  return (
    <>
      <div className="vbb-field vbb-col-span-2">
        <label htmlFor="pm-number">Card Number</label>
        <div className={cn('vbb-stripe-field', invalid && 'is-invalid')} id="pm-number">
          <CardNumberElement options={ELEMENT_OPTIONS} onChange={handle('number')} />
        </div>
      </div>
      <div className="vbb-field">
        <label htmlFor="pm-expiry">Expiry (MM / YY)</label>
        <div className={cn('vbb-stripe-field', invalid && 'is-invalid')} id="pm-expiry">
          <CardExpiryElement options={ELEMENT_OPTIONS} onChange={handle('expiry')} />
        </div>
      </div>
      <div className="vbb-field">
        <label htmlFor="pm-cvc">CVC</label>
        <div className={cn('vbb-stripe-field', invalid && 'is-invalid')} id="pm-cvc">
          <CardCvcElement options={ELEMENT_OPTIONS} onChange={handle('cvc')} />
        </div>
      </div>
    </>
  );
}

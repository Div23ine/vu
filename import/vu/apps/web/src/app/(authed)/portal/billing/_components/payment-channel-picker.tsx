'use client';

import { cn } from '@vunvault/lib';
import '../_styles/pay-dialog.css';

/**
 * Payment channel picker — real radios inside a native
 * `<fieldset><legend>` group, rendered as the design family's radio cards.
 * Copy is verbatim from the spec spec; the mapping to the wire contract
 * lives in the dialog (Card → `stripe`/`card`; M-Pesa → `paystack`/`mpesa`;
 * Bank transfer → `paystack`/`bank_transfer`).
 *
 * The three options are written out statically (like the an earlier iteration signup radio
 * cards): `jsx-a11y/label-has-associated-control` verifies a label's
 * accessible text statically, which dynamic `{expression}` children defeat.
 */

export type PaymentChannelChoice = 'card' | 'mpesa' | 'bank_transfer';

export interface PaymentChannelPickerProps {
  value: PaymentChannelChoice;
  onChange: (channel: PaymentChannelChoice) => void;
  /** False when neither a saved card nor a Stripe key is available. */
  cardAvailable: boolean;
  disabled?: boolean;
}

export function PaymentChannelPicker({
  value,
  onChange,
  cardAvailable,
  disabled = false,
}: PaymentChannelPickerProps) {
  return (
    <fieldset className="vbb-field vbb-channel-group">
      <legend className="vbb-channel-legend">Pay with</legend>
      <div className="vbb-channel-grid">
        <label className={cn('vbb-channel-card', !cardAvailable && 'is-unavailable')}>
          <input
            type="radio"
            name="vbb-payment-channel"
            value="card"
            aria-label="Card — Visa, Mastercard — processed by Stripe"
            checked={value === 'card'}
            disabled={disabled || !cardAvailable}
            onChange={() => onChange('card')}
          />
          <span className="vbb-channel-body">
            <span className="vbb-channel-dot" aria-hidden="true" />
            <span className="vbb-channel-text">
              <span className="vbb-channel-title">Card</span>
              <span className="vbb-channel-sub">Visa, Mastercard — processed by Stripe</span>
            </span>
          </span>
        </label>

        <label className="vbb-channel-card">
          <input
            type="radio"
            name="vbb-payment-channel"
            value="mpesa"
            aria-label="M-Pesa — Pay from your phone — processed by Paystack"
            checked={value === 'mpesa'}
            disabled={disabled}
            onChange={() => onChange('mpesa')}
          />
          <span className="vbb-channel-body">
            <span className="vbb-channel-dot" aria-hidden="true" />
            <span className="vbb-channel-text">
              <span className="vbb-channel-title">M-Pesa</span>
              <span className="vbb-channel-sub">Pay from your phone — processed by Paystack</span>
            </span>
          </span>
        </label>

        <label className="vbb-channel-card">
          <input
            type="radio"
            name="vbb-payment-channel"
            value="bank_transfer"
            aria-label="Bank transfer — Pay by transfer — processed by Paystack"
            checked={value === 'bank_transfer'}
            disabled={disabled}
            onChange={() => onChange('bank_transfer')}
          />
          <span className="vbb-channel-body">
            <span className="vbb-channel-dot" aria-hidden="true" />
            <span className="vbb-channel-text">
              <span className="vbb-channel-title">Bank transfer</span>
              <span className="vbb-channel-sub">Pay by transfer — processed by Paystack</span>
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

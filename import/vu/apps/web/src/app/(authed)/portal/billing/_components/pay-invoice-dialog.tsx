'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Elements, CardNumberElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { X } from 'lucide-react';
import type {
  CheckoutBody,
  DisplayCurrency,
  FxQuote,
  Invoice,
  PaymentChannel,
  PaymentProvider,
} from '@vunvault/contracts';
import { E164_PATTERN } from '@vunvault/contracts';
import { cn, formatUsd, isApiError, queryKeys } from '@vunvault/lib';
import { Dialog, DialogContent, DialogDescription, DialogTitle, toast } from '@vunvault/ui';
import { usePayDialogStore } from '../../../../../lib/pay-dialog-store';
import { getStripe, stripeKeyConfigured } from '../../../../../lib/stripe';
import { usePaymentMethod } from '../_hooks/use-billing';
import { useCheckout, useFxQuote, usePaymentAttempt } from '../_hooks/use-checkout';
import '../_styles/pay-dialog.css';
import { FxQuotePanel, defaultCurrencyForCountry } from './fx-quote-panel';
import { PaymentChannelPicker, type PaymentChannelChoice } from './payment-channel-picker';
import { StripeCardFields, type CardFieldsComplete } from './stripe-card-fields';

/**
 * Pay-invoice dialog — mounted once by `/portal/billing`, driven
 * by the `usePayDialogStore` an earlier iteration created (Pay Now buttons and the
 * `?invoice=` hand-off both fill it). Built on the an earlier iteration `Dialog` primitive
 * (Radix supplies `role="dialog"`, `aria-modal`, the focus trap and
 * Escape-to-close) with the billing page's `vbb-*` styling language.
 *
 * Hard rules, enforced here:
 * - the amount sent to any provider is ALWAYS the server-derived USD amount
 * — the checkout body carries no amount field at all, and the local
 * currency is display-only (locked FX quote, mm:ss countdown);
 * - `idempotencyKey = crypto.randomUUID()` is generated ONCE per dialog open
 * and reused across retries, so a double-click cannot double-charge;
 * - the synchronous checkout result is never trusted for ledger state:
 * every success path polls the invoices list (3 s, 60 s budget) until the
 * row reads `paid` before showing `Payment received`.
 *
 * Channel mapping: Card → `stripe`/`card` (saved method, or Stripe Elements
 * tokenisation as in an earlier iteration); M-Pesa → `paystack`/`mpesa`; Bank transfer →
 * `paystack`/`bank_transfer`. Spec note: `CheckoutBody` has no phone
 * field — the M-Pesa number is validated here for the Paystack prompt, but
 * the wire body stays exactly the contract.
 */

const MPESA_WAITING = 'Check your phone and enter your M-Pesa PIN to approve the payment.';
const QUOTE_EXPIRED_REFRESHED =
  'Your quote expired. We refreshed it — please review and pay again.';
const AMOUNT_CHANGED = 'The amount due changed. Please review the new amount.';
const CHANNEL_UNAVAILABLE =
  'This payment method is not available for this invoice right now. Choose another method.';
const PHONE_MESSAGE = 'Enter a valid phone number.';
const INCOMPLETE_CARD_FIELDS = 'Please complete all card fields';
const FAILED_NOT_CHARGED = 'The payment could not be completed. You have not been charged.';
const TIMEOUT_COPY =
  "We're confirming your payment. This can take a minute — you'll receive an email when it completes.";

/** `crypto.randomUUID` with a fallback for environments without it. */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function PayInvoiceDialog() {
  const invoice = usePayDialogStore((state) => state.invoice);
  const close = usePayDialogStore((state) => state.close);

  return (
    <Dialog
      open={invoice !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent size="md" className="vbb-pay-dialog" hideClose>
        {invoice !== null ? <PayInvoiceFlow invoice={invoice} onDone={close} /> : null}
      </DialogContent>
    </Dialog>
  );
}

interface PayInvoiceFlowProps {
  invoice: Invoice;
  onDone: () => void;
}

/** Elements must wrap everything that touches `useStripe`/`useElements`. */
function PayInvoiceFlow({ invoice, onDone }: PayInvoiceFlowProps) {
  const stripePromise = useMemo(() => (stripeKeyConfigured() ? getStripe() : null), []);
  return (
    <Elements stripe={stripePromise}>
      <PayInvoiceInner invoice={invoice} onDone={onDone} />
    </Elements>
  );
}

function PayInvoiceInner({ invoice, onDone }: PayInvoiceFlowProps) {
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  const fx = useFxQuote();
  const checkout = useCheckout();
  const savedMethod = usePaymentMethod();

  const saved = savedMethod.data ?? null;
  const stripeAvailable = stripeKeyConfigured();
  const cardAvailable = saved !== null || stripeAvailable;

  const countryTouched = useRef(false);
  const [currency, setCurrency] = useState<DisplayCurrency>(() =>
    defaultCurrencyForCountry(saved?.billingCountry),
  );
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [quoteExpired, setQuoteExpired] = useState(false);
  const [channel, setChannel] = useState<PaymentChannelChoice>('card');
  const [cardSource, setCardSource] = useState<'saved' | 'new'>(saved !== null ? 'saved' : 'new');
  const [cardComplete, setCardComplete] = useState<CardFieldsComplete>({
    number: false,
    expiry: false,
    cvc: false,
  });
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [waiting, setWaiting] = useState<'none' | 'mpesa' | 'generic'>('none');
  const [polling, setPolling] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const idempotencyKey = useMemo(newIdempotencyKey, []);

  const invalidateBilling = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.billing.invoices({ page: 1, pageSize: 10 }),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.billing.subscription() });
  }, [queryClient]);

  const requestQuote = useCallback(
    (target: DisplayCurrency) => {
      setQuoteExpired(false);
      if (target === 'USD') {
        setQuote(null);
        return;
      }
      fx.mutateAsync({ invoiceId: invoice.id, displayCurrency: target })
        .then((fresh) => {
          setQuote(fresh);
        })
        .catch(() => {
          setQuote(null);
        });
    },
    [fx, invoice.id],
  );

  // Quote on open (skipped for USD).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    requestQuote(currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per open
  }, []);

  // The saved method arrives async: adopt its defaults until the user picks —
  // including the country-derived display currency, whose quote must then be
  // requested (the open-effect ran while the country was still unknown).
  useEffect(() => {
    if (saved === null || countryTouched.current) return;
    setCardSource('saved');
    const next = defaultCurrencyForCountry(saved.billingCountry);
    if (next !== currency) {
      setCurrency(next);
      requestQuote(next);
    }
  }, [saved, currency, requestQuote]);

  const attemptState = usePaymentAttempt(invoice.id, polling);

  useEffect(() => {
    if (attemptState === 'paid') {
      setPolling(false);
      setSucceeded(true);
      invalidateBilling();
    } else if (attemptState === 'timed_out') {
      setPolling(false);
      // Authored toast title (the spec pinned the message copy only).
      toast({ kind: 'info', title: 'Payment processing', message: TIMEOUT_COPY });
      onDone();
    }
  }, [attemptState, invalidateBilling, onDone]);

  const onCurrencyChange = (next: DisplayCurrency) => {
    countryTouched.current = true;
    setCurrency(next);
    setQuote(null);
    setInlineError('');
    requestQuote(next);
  };

  const quoteRequired = currency !== 'USD';
  const quoteReady = !quoteRequired || (quote !== null && !quoteExpired && !fx.isPending);
  const chargeUsdCents =
    quoteRequired && quote !== null ? quote.usdCents : invoice.outstandingUsdCents;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (checkout.isPending || polling) return;
    setInlineError('');
    setPhoneError('');

    if (channel === 'mpesa') {
      const normalized = phone.replace(/[\s\-().]/g, '');
      if (!E164_PATTERN.test(normalized)) {
        setPhoneError(PHONE_MESSAGE);
        return;
      }
    }

    let provider: PaymentProvider;
    let wireChannel: PaymentChannel;
    let token: string | undefined;
    if (channel === 'card') {
      provider = 'stripe';
      wireChannel = 'card';
      const usingNewCard = cardSource === 'new' || saved === null;
      if (usingNewCard) {
        if (!cardComplete.number || !cardComplete.expiry || !cardComplete.cvc) {
          setInlineError(INCOMPLETE_CARD_FIELDS);
          return;
        }
        const element = elements?.getElement(CardNumberElement) ?? null;
        if (stripe === null || element === null) {
          setInlineError(FAILED_NOT_CHARGED);
          return;
        }
        const result = await stripe.createPaymentMethod({
          type: 'card',
          card: element,
          billing_details: { name: saved?.cardholderName ?? undefined },
        });
        if (result.error !== undefined) {
          setInlineError(result.error.message ?? FAILED_NOT_CHARGED);
          return;
        }
        token = result.paymentMethod?.id;
        if (token === undefined) {
          setInlineError(FAILED_NOT_CHARGED);
          return;
        }
      }
    } else if (channel === 'mpesa') {
      provider = 'paystack';
      wireChannel = 'mpesa';
    } else {
      provider = 'paystack';
      wireChannel = 'bank_transfer';
    }

    const body: CheckoutBody = {
      invoiceId: invoice.id,
      ...(quoteRequired && quote !== null ? { fxQuoteId: quote.id } : {}),
      provider,
      channel: wireChannel,
      ...(token !== undefined ? { providerPaymentMethodToken: token } : {}),
      idempotencyKey,
    };

    try {
      const result = await checkout.mutateAsync(body);
      if (result.redirectUrl !== undefined) {
        // Paystack hosted checkout; it returns to /portal/billing?invoice=<id>&paid=1.
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.status === 'succeeded') {
        setPolling(true);
        return;
      }
      if (result.status === 'requires_action') {
        if (result.clientSecret !== undefined && stripe !== null) {
          const confirmed = await stripe.confirmCardPayment(result.clientSecret);
          if (confirmed.error !== undefined) {
            setInlineError(confirmed.error.message ?? FAILED_NOT_CHARGED);
            return;
          }
        }
        setPolling(true);
        return;
      }
      if (result.status === 'created') {
        setWaiting(channel === 'mpesa' ? 'mpesa' : 'generic');
        setPolling(true);
        return;
      }
      setInlineError(FAILED_NOT_CHARGED);
    } catch (error) {
      if (isApiError(error) && error.status === 409 && error.code === 'quote_expired') {
        requestQuote(currency);
        setInlineError(QUOTE_EXPIRED_REFRESHED);
        return;
      }
      if (isApiError(error) && error.status === 409 && error.code === 'amount_changed') {
        requestQuote(currency);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.billing.invoices({ page: 1, pageSize: 10 }),
        });
        setInlineError(AMOUNT_CHANGED);
        return;
      }
      if (isApiError(error) && error.status === 409 && error.code === 'already_paid') {
        invalidateBilling();
        onDone();
        return;
      }
      if (isApiError(error) && error.status === 422 && error.code === 'channel_unavailable') {
        setInlineError(CHANNEL_UNAVAILABLE);
        return;
      }
      // Network failure or an unknown API error — no attempt id came back.
      toast({
        kind: 'crit',
        title: 'Payment not completed',
        message: 'You have not been charged. Please try again.',
      });
    }
  };

  if (succeeded) {
    return (
      <div className="vbb-pay-success" role="status">
        <DialogTitle className="vbb-modal-title">Payment received</DialogTitle>
        {/* Screen-reader description so Radix never warns about an
      undescribed dialog; not part of the visible spec copy. */}
        <DialogDescription className="sr-only">
          The payment was confirmed and the invoice is paid.
        </DialogDescription>
        <p className="vbb-pay-success-text">
          Invoice {invoice.number} is paid. A receipt has been emailed to you.
        </p>
        <div className="vbb-modal-actions">
          <button type="button" className="vbb-btn vbb-btn--primary" onClick={onDone}>
            <span>Done</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      id="vbb-pay-form"
      onSubmit={(event) => void onSubmit(event)}
      className="vbb-pay-form"
      noValidate
    >
      <div className="vbb-pay-head">
        <div>
          <span className="vbb-eyebrow">Secure payment</span>
          <DialogTitle className="vbb-modal-title">Pay invoice {invoice.number}</DialogTitle>
          <DialogDescription className="vbb-modal-text">
            Charged in US dollars (USD). Local currency is shown for reference only.
          </DialogDescription>
        </div>
        <button
          type="button"
          className="vbb-modal-close"
          aria-label="Close dialog"
          onClick={onDone}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      {waiting !== 'none' ? (
        <div className="vbb-waiting" role="status">
          <span className="vbb-btn-spinner" aria-hidden="true" />
          {waiting === 'mpesa' ? <p className="vbb-waiting-text">{MPESA_WAITING}</p> : null}
        </div>
      ) : (
        <>
          <div className="vbb-summary-row">
            <div className="vbb-summary-service">
              <span className="vbb-inv-service">{invoice.title}</span>
              {invoice.detail !== null ? (
                <span className="vbb-inv-service-detail">{invoice.detail}</span>
              ) : null}
            </div>
            <div className="vbb-summary-due">
              <span className="vbb-metric-label">Amount due</span>
              <span className="vbb-inv-amount">{formatUsd(invoice.outstandingUsdCents)}</span>
            </div>
          </div>

          <FxQuotePanel
            currency={currency}
            onCurrencyChange={onCurrencyChange}
            quote={quote}
            loading={fx.isPending}
            onRefresh={() => requestQuote(currency)}
            usdCents={chargeUsdCents}
            onExpire={() => setQuoteExpired(true)}
            disabled={checkout.isPending}
          />

          <PaymentChannelPicker
            value={channel}
            onChange={(next) => {
              setChannel(next);
              setInlineError('');
            }}
            cardAvailable={cardAvailable}
            disabled={checkout.isPending}
          />

          {channel === 'card' ? (
            saved !== null ? (
              <div className="vbb-card-source" role="radiogroup" aria-label="Card source">
                <label className="vbb-card-source-option">
                  <input
                    type="radio"
                    name="vbb-card-source"
                    checked={cardSource === 'saved'}
                    onChange={() => setCardSource('saved')}
                  />
                  <span>
                    Use saved {saved.brand} •••• {saved.last4}
                  </span>
                </label>
                <label className="vbb-card-source-option">
                  <input
                    type="radio"
                    name="vbb-card-source"
                    checked={cardSource === 'new'}
                    disabled={!stripeAvailable}
                    onChange={() => setCardSource('new')}
                  />
                  <span>Use a different card</span>
                </label>
              </div>
            ) : null
          ) : null}

          {channel === 'card' && (cardSource === 'new' || saved === null) ? (
            stripeAvailable ? (
              <div className="vbb-grid-form vbb-card-fields">
                <StripeCardFields onChange={setCardComplete} />
              </div>
            ) : (
              <p className="vbb-modal-unavailable" role="status">
                Card updates are temporarily unavailable.
              </p>
            )
          ) : null}

          {channel === 'mpesa' ? (
            <div className="vbb-field">
              <label htmlFor="vbb-mpesa-phone">Phone number</label>
              <input
                id="vbb-mpesa-phone"
                className={cn('vbb-input', phoneError !== '' && 'is-invalid')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+254 7XX XXX XXX"
                value={phone}
                aria-invalid={phoneError !== ''}
                aria-describedby="vbb-mpesa-phone-error"
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (phoneError !== '') setPhoneError('');
                }}
              />
              {phoneError !== '' ? (
                <span className="vbb-field-error" id="vbb-mpesa-phone-error" role="alert">
                  {phoneError}
                </span>
              ) : null}
            </div>
          ) : null}

          {inlineError !== '' ? (
            <p className="vbb-field-error" id="vbb-pay-error" role="alert" aria-live="polite">
              {inlineError}
            </p>
          ) : null}
        </>
      )}

      <div className="vbb-modal-actions">
        <button type="button" className="vbb-btn vbb-btn--ghost" onClick={onDone}>
          Cancel
        </button>
        <button
          type="submit"
          className="vbb-btn vbb-btn--primary"
          id="vbb-pay-submit"
          disabled={checkout.isPending || polling || !quoteReady}
          aria-busy={checkout.isPending || polling}
        >
          {checkout.isPending || polling ? (
            <span className="vbb-btn-spinner" aria-hidden="true" />
          ) : null}
          <span>Pay {formatUsd(chargeUsdCents)}</span>
        </button>
      </div>
    </form>
  );
}

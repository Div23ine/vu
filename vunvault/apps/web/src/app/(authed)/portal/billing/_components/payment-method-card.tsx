'use client';

import { useState } from 'react';
import { CreditCard, Pencil, ShieldCheck } from 'lucide-react';
import type { PaymentMethodView } from '@vunvault/contracts';
import { Skeleton } from '@vunvault/ui';
import { isNotFound, usePaymentMethod } from '../_hooks/use-billing';
import { EditPaymentDialog } from './edit-payment-dialog';

/**
 * Payment-method card (Task 66) — the tokenised-card visual plus the Edit
 * dialog. Only ever displays what the API stores (brand, last4, expiry,
 * holder): the model cannot carry a PAN. The masked number renders
 * `•••• •••• •••• <last4>` — the prototype's first digit group is not
 * derivable from last4 (spec note). A 404 is the `No payment method on file`
 * state whose button opens the same dialog.
 */

function expiryOf(method: PaymentMethodView): string {
  return `${String(method.expMonth).padStart(2, '0')} / ${method.expYear}`;
}

export function PaymentMethodCard() {
  const { data, isLoading, error } = usePaymentMethod();
  const [dialogOpen, setDialogOpen] = useState(false);

  const closeDialog = () => setDialogOpen(false);
  const openDialog = () => setDialogOpen(true);

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className="vbb-pay" aria-busy="true">
        <Skeleton className="h-[200px] w-full rounded-3xl" />
      </div>
    );
  } else if (data === undefined || (error !== null && isNotFound(error))) {
    body = (
      <div className="vbb-pay">
        <div className="vbb-pay-empty">
          No payment method on file
          <button type="button" className="vbb-btn vbb-btn--dark" onClick={openDialog}>
            <CreditCard size={15} aria-hidden="true" />
            <span>Add Payment Method</span>
          </button>
        </div>
        <p className="vbb-pay-note">
          <ShieldCheck size={13} aria-hidden="true" />
          Card details are tokenised and stored by our PCI-DSS compliant payment processor.
        </p>
      </div>
    );
  } else {
    const method = data;
    body = (
      <div className="vbb-pay">
        <div className="vbb-credit-card">
          <div className="vbb-cc-top">
            <span className="vbb-cc-chip" aria-hidden="true" />
            <div className="vbb-cc-brand">
              <span className="vbb-cc-brand-name">{method.brand}</span>
              <span className="vbb-cc-brand-dots" aria-hidden="true">
                <span />
                <span />
              </span>
            </div>
          </div>
          <div className="vbb-cc-number" id="vbb-cc-number">
            {'•••• •••• ••••'} {method.last4}
          </div>
          <div className="vbb-cc-foot">
            <div className="vbb-cc-block">
              <div className="vbb-cc-block-label">Card Holder</div>
              <div className="vbb-cc-block-value" id="vbb-cc-holder">
                {(method.cardholderName ?? '').toUpperCase()}
              </div>
            </div>
            <div className="vbb-cc-block">
              <div className="vbb-cc-block-label">Expires</div>
              <div className="vbb-cc-block-value" id="vbb-cc-expiry">
                {expiryOf(method)}
              </div>
            </div>
          </div>
        </div>
        <div className="vbb-pay-actions">
          <button
            type="button"
            className="vbb-btn vbb-btn--dark"
            aria-controls="editPaymentModal"
            aria-expanded={dialogOpen}
            onClick={openDialog}
          >
            <Pencil size={15} aria-hidden="true" />
            <span>Edit Payment Method</span>
          </button>
        </div>
        <p className="vbb-pay-note">
          <ShieldCheck size={13} aria-hidden="true" />
          Card details are tokenised and stored by our PCI-DSS compliant payment processor.
        </p>
      </div>
    );
  }

  return (
    <div className="vbb-card">
      <div className="vbb-card-head">
        <div className="vbb-card-title-row">
          <span className="vbb-card-icon" aria-hidden="true">
            <CreditCard size={20} />
          </span>
          <div>
            <h2 className="vbb-card-title">Payment Method</h2>
            <p className="vbb-card-sub">Used for all recurring charges and one-off engagements.</p>
          </div>
        </div>
      </div>
      {body}
      <EditPaymentDialog open={dialogOpen} onClose={closeDialog} method={data ?? null} />
    </div>
  );
}

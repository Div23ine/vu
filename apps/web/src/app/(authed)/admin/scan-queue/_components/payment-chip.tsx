import type { PaymentStatus } from '@vunvault/contracts';
import { PAYMENT_STATUS_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import '../_styles/scan-queue.css';

/**
 * Payment chip — `PAYMENT_STATUS_LABELS` text on the admin badge
 * families, with the design's verbatim state tooltips for the two
 * outstanding cases.
 */

const TONE_CLASS: Record<PaymentStatus, string> = {
  paid: 'adm-badge--settled',
  pending: 'adm-badge--pending',
  overdue: 'adm-badge--refunded',
};

const TOOLTIP: Partial<Record<PaymentStatus, string>> = {
  pending: 'Pending — awaiting settlement',
  overdue: 'Overdue — collection required',
};

export function PaymentChip({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn('adm-badge', TONE_CLASS[status])} title={TOOLTIP[status]}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

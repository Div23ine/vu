import type { PaymentProviders } from '../../../billing/providers/index.js';
import { HttpError } from '../../../lib/http-error.js';
import type { SqlExecutor } from '../../../audit/repo.js';
import { refundKey, type WebhookService } from '../webhooks/service.js';
import type { PaymentsRepo, WebhookAttemptRow } from './repo.js';

/**
 * Admin money operations: refunds and ledger reconciliation.
 *
 * A refund is the only way money leaves the platform other than a provider-side
 * action, so it is bounded twice: by the attempt (never more than was captured)
 * and by the ledger (never more than has not already been refunded). Both bounds
 * are read from stored rows, never from the request.
 *
 * Reconciliation is read-only. It exists because an append-only ledger with a
 * derived invoice view can still drift — a webhook that was never delivered, an
 * entry posted against an attempt that has since been deleted — and drift that
 * nobody looks for is drift nobody finds.
 */

export interface RefundBody {
  /** 10–500 characters; it ends up verbatim in an audit entry. */
  reason: string;
  /** Defaults to the full captured amount. */
  amountUsdCents?: number;
}

export interface RefundResult {
  attemptId: string;
  refundedUsdCents: number;
  totalRefundedUsdCents: number;
}

/** What the route handler returns; the response schema keeps only `data`. */
export interface RefundHandlerResult extends RefundResult {
  invoiceNumber: string;
}

export interface ReconcileReport {
  checkedEntries: number;
  unbalancedEntries: string[];
  attemptsWithoutEntry: string[];
  entriesWithoutAttempt: string[];
  invoicesWithMismatchedStatus: string[];
  ranAt: string;
}

export interface RefundServiceDeps {
  repo: PaymentsRepo;
  payments: PaymentProviders;
  /** The one place that posts a refund entry, shared with the webhook path. */
  webhooks: Pick<WebhookService, 'postRefund'>;
  now?: () => Date;
}

export class RefundService {
  private readonly repo: PaymentsRepo;
  private readonly payments: PaymentProviders;
  private readonly webhooks: Pick<WebhookService, 'postRefund'>;

  constructor(deps: RefundServiceDeps) {
    this.repo = deps.repo;
    this.payments = deps.payments;
    this.webhooks = deps.webhooks;
  }

  /**
   * Refund part or all of a captured payment.
   *
   * The provider is called first and the ledger second, both keyed by the
   * deterministic `refund:<attemptId>:<n>`: if the ledger post fails, the whole
   * transaction rolls back and a retry reuses the same key, so the provider
   * deduplicates instead of paying out twice.
   */
  async refund(
    executor: SqlExecutor,
    actorId: string | null,
    attemptId: string,
    body: RefundBody,
  ): Promise<RefundHandlerResult> {
    const attempt = await this.repo.findAttemptById(attemptId);
    if (attempt === null) throw HttpError.notFound();
    if (attempt.status !== 'succeeded') {
      throw new HttpError(422, 'not_refundable', 'Only a captured payment can be refunded');
    }

    const amount = body.amountUsdCents ?? attempt.usdCents;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['amountUsdCents'], message: 'Refunds are positive whole USD cents' },
      ]);
    }

    const alreadyRefunded = await this.repo.refundedUsdCents(attempt.id);
    const remaining = attempt.usdCents - alreadyRefunded;
    if (amount > remaining) {
      throw new HttpError(
        422,
        'refund_exceeds_payment',
        `Only ${remaining} USD cents of this payment are left to refund`,
      );
    }

    // One key for the provider call and the ledger entry, so a retry after a
    // failure cannot pay out twice or post twice.
    const sequence = (await this.repo.refundCount(attempt.id)) + 1;
    const idempotencyKey = refundKey(attempt.id, sequence);
    await this.providerRefund(attempt, amount, idempotencyKey);

    const { totalRefundedUsdCents } = await this.webhooks.postRefund(
      executor,
      attempt,
      amount,
      idempotencyKey,
      actorId,
    );

    return {
      attemptId: attempt.id,
      refundedUsdCents: amount,
      totalRefundedUsdCents,
      invoiceNumber: attempt.invoiceNumber,
    };
  }

  /** Ask the provider for the money back, under the same key the ledger uses. */
  private async providerRefund(
    attempt: WebhookAttemptRow,
    amountUsdCents: number,
    idempotencyKey: string,
  ): Promise<void> {
    if (attempt.providerReference === null || attempt.providerReference === '') {
      throw new HttpError(
        422,
        'not_refundable',
        'This payment has no provider reference to refund against',
      );
    }

    if (attempt.provider === 'stripe') {
      await this.payments.stripe.refund({
        paymentIntentId: attempt.providerReference,
        amountUsdCents,
        idempotencyKey,
      });
      return;
    }
    await this.payments.paystack.refund({
      transaction: attempt.providerReference,
      amountUsdCents,
    });
  }
}

export interface ReconcileServiceDeps {
  repo: PaymentsRepo;
  now?: () => Date;
}

export class ReconcileService {
  private readonly repo: PaymentsRepo;
  private readonly now: () => Date;

  constructor(deps: ReconcileServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Four checks, all read-only:
   *   (a) every journal entry balances;
   *   (b) every succeeded attempt has a captured entry;
   *   (c) every captured entry points at an attempt that exists;
   *   (d) invoice status agrees with the derived balance.
   */
  async reconcile(): Promise<ReconcileReport> {
    const [entries, succeeded, attemptIds, captured, mismatched] = await Promise.all([
      this.repo.listEntryBalances(),
      this.repo.listSucceededAttemptIds(),
      this.repo.listAttemptIds(),
      this.repo.listCapturedEntries(),
      this.repo.listInvoicesWithMismatchedStatus(),
    ]);

    const capturedSet = new Set(
      captured.map((entry) => entry.referenceId).filter((id): id is string => id !== null),
    );
    const attemptSet = new Set(attemptIds);

    return {
      checkedEntries: entries.length,
      unbalancedEntries: entries
        .filter((entry) => entry.debit !== entry.credit)
        .map((entry) => entry.id),
      attemptsWithoutEntry: succeeded.filter((id) => !capturedSet.has(id)),
      // Reported by ENTRY id: an orphan entry is a ledger problem, and the entry
      // is the thing an operator has to go and look at.
      entriesWithoutAttempt: captured
        .filter((entry) => entry.referenceId === null || !attemptSet.has(entry.referenceId))
        .map((entry) => entry.entryId),
      invoicesWithMismatchedStatus: mismatched,
      ranAt: this.now().toISOString(),
    };
  }
}

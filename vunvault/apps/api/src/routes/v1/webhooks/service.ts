import type { NotifyJobPayload } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import { isProviderError } from '../../../providers/error';
import type { PaymentProviders } from '../../../billing/providers';
import type { StripeWebhookEvent } from '../../../billing/providers/stripe';
import { usd } from '../billing/service';
import type { SqlExecutor } from '../../../audit/repo';
import { asExecutor } from '../../../audit/repo';
import type { AuditService } from '../../../audit/service';
import type { LedgerService } from '../../../billing/ledger';
import {
  clearingAccountFor,
  type PaymentsRepo,
  type WebhookAttemptRow,
} from '../payments-admin/repo';
import { SqlStoreRepo } from '../store/repo';
import { EntitlementService } from '../store/service';

/**
 * Provider webhooks.
 *
 * Three rules decide the shape of this module.
 *
 * 1. NOTHING is trusted from a provider payload. An amount or a currency is
 *    always compared against the stored attempt, and a mismatch fails the attempt
 *    instead of posting money: a webhook that says "$10,000 paid" against a
 *    $2,499 attempt is a bug or an attack, and neither should reach the ledger.
 * 2. The ledger is written ONLY here and by an admin refund. `payment_captured`
 *    is posted from a signature-verified event, inside one transaction with the
 *    attempt update, the invoice recompute and the audit entry.
 * 3. Every event is stored before it is processed, keyed by the provider's event
 *    id, so a replay answers 200 and does nothing. A processing error rolls the
 *    event row back with the transaction and answers 500, which is what makes the
 *    provider retry.
 *
 * The actor on every entry written from a webhook is `{ id: null, label: "system" }`:
 * no human being did this.
 */

/** The actor for machine-originated entries. */
export const SYSTEM_ACTOR = { id: null, label: 'system' } as const;

/** Idempotency key for the ledger entry a captured payment posts. */
export function captureKey(attemptId: string): string {
  return `pay:${attemptId}`;
}

/** Idempotency key for the `n`th refund against an attempt. */
export function refundKey(attemptId: string, n: number): string {
  return `refund:${attemptId}:${n}`;
}

/** An amount that does not match the attempt is never posted. */
export const AMOUNT_MISMATCH = 'amount_mismatch';
export const CURRENCY_MISMATCH = 'currency_mismatch';

/** Notification templates rendered by the notify worker. */
export const RECEIPT_TEMPLATE = 'payment_receipt';
export const FAILURE_TEMPLATE = 'payment_failed';

export interface WebhookEvent {
  /** Provider event id, or a derived dedupe key when the provider sends none. */
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export type WebhookOutcome =
  | { kind: 'replay' }
  | { kind: 'ignored'; type: string }
  | { kind: 'captured'; attemptId: string; invoiceNumber: string; usdCents: number }
  | { kind: 'amount_mismatch'; attemptId: string }
  | { kind: 'failed'; attemptId: string; reason: string }
  | { kind: 'requires_action'; attemptId: string }
  | { kind: 'refund_reconciled'; attemptId: string; usdCents: number };

export interface WebhookServiceDeps {
  repo: PaymentsRepo;
  ledger: Pick<LedgerService, 'post'>;
  audit: Pick<AuditService, 'append'>;
  payments: PaymentProviders;
  /** Enqueues a `notify` job; wired to `app.queues.notify` by the route. */
  enqueue?: (payload: NotifyJobPayload) => Promise<void>;
  /**
   * Grants the licences a paid invoice buys. Injected in tests; in production it is
   * built here against the same transaction, because the webhook route does not
   * know about the store and should not have to.
   */
  entitlements?: Pick<EntitlementService, 'grantForInvoice'>;
  now?: () => Date;
  log?: { warn: (message: string, error?: unknown) => void; info: (message: string) => void };
}

export class WebhookService {
  private readonly repo: PaymentsRepo;
  private readonly ledger: Pick<LedgerService, 'post'>;
  private readonly audit: Pick<AuditService, 'append'>;
  private readonly payments: PaymentProviders;
  private readonly enqueue: ((payload: NotifyJobPayload) => Promise<void>) | undefined;
  private readonly deps: WebhookServiceDeps;
  private readonly now: () => Date;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(deps: WebhookServiceDeps) {
    this.deps = deps;
    this.repo = deps.repo;
    this.ledger = deps.ledger;
    this.audit = deps.audit;
    this.payments = deps.payments;
    this.enqueue = deps.enqueue;
    this.now = deps.now ?? (() => new Date());
    this.warn = deps.log?.warn.bind(deps.log) ?? (() => undefined);
  }

  /**
   * Verify a Stripe signature over the RAW body and normalise the event.
   * Throws `HttpError(401, "bad_signature")` on any verification failure.
   */
  parseStripe(
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined,
  ): WebhookEvent {
    const body = toBuffer(rawBody);
    if (body === undefined || signatureHeader === undefined || signatureHeader === '') {
      throw badSignature('stripe');
    }
    let event: StripeWebhookEvent;
    try {
      event = this.payments.stripe.verifyWebhook(body, signatureHeader, undefined, this.now());
    } catch (error) {
      throw badSignature('stripe', error);
    }
    return { id: event.id, type: event.type, payload: event.data.object };
  }

  /**
   * Verify a Paystack signature (HMAC-SHA512 over the raw body) and normalise the
   * event. Paystack sends no event id, so the dedupe key is derived from the event
   * type and the transaction reference — which is exactly the pair that identifies
   * one notification.
   */
  parsePaystack(
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined,
  ): WebhookEvent {
    const raw = toBuffer(rawBody);
    if (raw === undefined || signatureHeader === undefined || signatureHeader === '') {
      throw badSignature('paystack');
    }
    let body: Record<string, unknown>;
    try {
      body = this.payments.paystack.verifyWebhook(raw, signatureHeader);
    } catch (error) {
      throw badSignature('paystack', error);
    }
    const type = typeof body.event === 'string' ? body.event : '';
    const data = (body.data ?? {}) as Record<string, unknown>;
    const reference = readReference(data, 'paystack');
    const id = typeof body.id === 'string' ? body.id : `${type}:${reference}`;
    return { id, type, payload: data };
  }

  /**
   * Store the event, then process it. Returns `replay` when the id was already
   * stored, which the route answers with 200 and no further work.
   */
  async handle(
    tx: unknown,
    provider: 'stripe' | 'paystack',
    event: WebhookEvent,
  ): Promise<WebhookOutcome> {
    const executor = asExecutor(tx);
    const fresh = await this.repo.recordWebhookEvent(provider, event.id, event.payload);
    if (!fresh) return { kind: 'replay' };

    const outcome = await this.process(executor, provider, event);
    await this.repo.markEventProcessed(provider, event.id, this.now());
    return outcome;
  }

  /** Dispatch on the event type. Unknown events are stored and ignored. */
  async process(
    executor: SqlExecutor,
    provider: 'stripe' | 'paystack',
    event: WebhookEvent,
  ): Promise<WebhookOutcome> {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'charge.success':
        return this.captured(executor, provider, event);
      case 'payment_intent.payment_failed':
      case 'charge.failed':
        return this.failed(executor, provider, event);
      case 'payment_intent.requires_action':
        return this.requiresAction(executor, provider, event);
      case 'charge.refunded':
      case 'refund.processed':
        return this.refundReconciled(executor, provider, event);
      default:
        return { kind: 'ignored', type: event.type };
    }
  }

  // ------------------------------------------------------------- captured

  private async captured(
    executor: SqlExecutor,
    provider: 'stripe' | 'paystack',
    event: WebhookEvent,
  ): Promise<WebhookOutcome> {
    const reference = readReference(event.payload, provider);
    const attempt = await this.repo.findAttemptByProviderReference(provider, reference);
    if (attempt === null) {
      this.warn(`webhook references an unknown ${provider} attempt: ${reference}`);
      return { kind: 'ignored', type: event.type };
    }

    const amount = readAmount(event.payload, provider);
    const currency = readCurrency(event.payload);

    // The provider's numbers are compared, never believed.
    if (amount !== attempt.usdCents || currency.toUpperCase() !== 'USD') {
      const reason = amount !== attempt.usdCents ? AMOUNT_MISMATCH : CURRENCY_MISMATCH;
      await this.repo.setAttemptStatus(attempt.id, 'failed', reason);
      await this.audit.append(executor, {
        eventType: 'PAYMENT_FAILED',
        actor: SYSTEM_ACTOR,
        subject: attempt.id,
        message: `${attempt.invoiceNumber} webhook reported ${amount} ${currency} against an attempt for ${attempt.usdCents} USD cents — nothing was posted`,
        details: { provider, reason, expectedUsdCents: attempt.usdCents, reportedAmount: amount },
      });
      return { kind: 'amount_mismatch', attemptId: attempt.id };
    }

    await this.repo.setAttemptStatus(attempt.id, 'succeeded', null);

    // Cash lands in the provider's clearing account against the receivable. One
    // entry per attempt, forever: the key is the attempt id.
    await this.ledger.post(executor, {
      orgId: attempt.orgId,
      kind: 'payment_captured',
      memo: `${attempt.invoiceNumber} — ${attempt.txnCode}`,
      referenceType: 'payment_attempt',
      referenceId: attempt.id,
      idempotencyKey: captureKey(attempt.id),
      occurredAt: this.now(),
      lines: [
        {
          accountCode: clearingAccountFor(provider),
          direction: 'debit',
          amountUsdCents: attempt.usdCents,
        },
        {
          accountCode: 'accounts_receivable',
          direction: 'credit',
          amountUsdCents: attempt.usdCents,
        },
      ],
    });

    await this.settleInvoice(executor, attempt);
    await this.releaseScanJob(attempt);
    await this.notifyContacts(attempt, RECEIPT_TEMPLATE, {
      amount: usd(attempt.usdCents),
      status: 'paid',
    });

    await this.audit.append(executor, {
      eventType: 'PAYMENT_CAPTURED',
      actor: SYSTEM_ACTOR,
      subject: attempt.id,
      message: `${attempt.invoiceNumber} paid · $${usd(attempt.usdCents)} via ${provider}`,
      details: { provider, channel: attempt.channel, usdCents: attempt.usdCents },
    });

    return {
      kind: 'captured',
      attemptId: attempt.id,
      invoiceNumber: attempt.invoiceNumber,
      usdCents: attempt.usdCents,
    };
  }

  /** Recompute from the ledger view; only a zero balance marks the invoice paid. */
  private async settleInvoice(executor: SqlExecutor, attempt: WebhookAttemptRow): Promise<void> {
    const balance = await this.repo.getBalance(attempt.invoiceId);
    if (balance.outstandingUsdCents !== 0) return;
    await this.repo.setInvoiceStatus(attempt.invoiceId, 'paid');
    // A settled invoice is what a licence is earned by. Granted here, inside the
    // webhook's transaction, so the ledger entry and the entitlement commit
    // together — and idempotently, so a replayed capture mints no second key.
    await this.entitlements(executor).grantForInvoice(executor, attempt.invoiceId);
  }

  private entitlements(executor: SqlExecutor): Pick<EntitlementService, 'grantForInvoice'> {
    if (this.deps.entitlements !== undefined) return this.deps.entitlements;
    return new EntitlementService({
      repo: new SqlStoreRepo(executor),
      audit: this.audit,
      enqueueEmail:
        this.enqueue === undefined
          ? undefined
          : async (input) => {
              const enqueue = this.enqueue;
              if (enqueue === undefined) return;
              await enqueue({ channel: 'email', ...input });
            },
    });
  }

  /**
   * Paying the invoice is what unblocks a scan. The review gate still has to be
   * passed by a human: `blocked_payment` becomes `in_review`, never `approved`.
   */
  private async releaseScanJob(attempt: WebhookAttemptRow): Promise<void> {
    if (attempt.scanJobId === null) return;
    const job = await this.repo.getScanJob(attempt.scanJobId);
    if (job === null) return;
    await this.repo.setJobPaymentStatus(job.id, 'paid');
    if (job.reviewGateState === 'blocked_payment') {
      await this.repo.setJobReviewGateState(job.id, 'in_review');
    }
  }

  // --------------------------------------------------------------- failed

  private async failed(
    executor: SqlExecutor,
    provider: 'stripe' | 'paystack',
    event: WebhookEvent,
  ): Promise<WebhookOutcome> {
    const reference = readReference(event.payload, provider, 'failed');
    const attempt = await this.repo.findAttemptByProviderReference(provider, reference);
    if (attempt === null) {
      this.warn(`webhook references an unknown ${provider} attempt: ${reference}`);
      return { kind: 'ignored', type: event.type };
    }

    const reason = readFailureReason(event.payload, provider);
    await this.repo.setAttemptStatus(attempt.id, 'failed', reason);
    await this.notifyContacts(attempt, FAILURE_TEMPLATE, { reason });

    await this.audit.append(executor, {
      eventType: 'PAYMENT_FAILED',
      actor: SYSTEM_ACTOR,
      subject: attempt.id,
      message: `${attempt.invoiceNumber} payment via ${provider} failed`,
      details: { provider, reason, usdCents: attempt.usdCents },
    });
    return { kind: 'failed', attemptId: attempt.id, reason };
  }

  // ------------------------------------------------------ requires action

  private async requiresAction(
    _executor: SqlExecutor,
    provider: 'stripe' | 'paystack',
    event: WebhookEvent,
  ): Promise<WebhookOutcome> {
    const reference = readReference(event.payload, provider);
    const attempt = await this.repo.findAttemptByProviderReference(provider, reference);
    if (attempt === null) return { kind: 'ignored', type: event.type };
    // No ledger entry and no audit event: nothing has been decided yet, the
    // browser still has to complete 3-D Secure.
    await this.repo.setAttemptStatus(attempt.id, 'requires_action', null);
    return { kind: 'requires_action', attemptId: attempt.id };
  }

  // -------------------------------------------------------------- refunds

  /**
   * A refund the provider reports. Refunds issued through `RefundService` already
   * have their ledger entry, so this is idempotent: when an entry exists the event
   * changes nothing. A refund made directly in the provider dashboard is posted
   * here, because the ledger has to describe reality.
   */
  private async refundReconciled(
    executor: SqlExecutor,
    provider: 'stripe' | 'paystack',
    event: WebhookEvent,
  ): Promise<WebhookOutcome> {
    const reference = readReference(event.payload, provider, 'refunded');
    const attempt = await this.repo.findAttemptByProviderReference(provider, reference);
    if (attempt === null) {
      this.warn(`refund webhook references an unknown ${provider} attempt: ${reference}`);
      return { kind: 'ignored', type: event.type };
    }

    const existing = await this.repo.refundCount(attempt.id);
    if (existing > 0) return { kind: 'ignored', type: event.type };

    const amount = readAmount(event.payload, provider, 'refunded');
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > attempt.usdCents) {
      this.warn(`refund webhook reported an unusable amount for ${attempt.txnCode}`);
      return { kind: 'ignored', type: event.type };
    }

    const { totalRefundedUsdCents } = await this.postRefund(
      executor,
      attempt,
      amount,
      refundKey(attempt.id, 1),
      null,
    );
    await this.audit.append(executor, {
      eventType: 'REFUND_ISSUED',
      actor: SYSTEM_ACTOR,
      subject: attempt.id,
      message: `$${usd(amount)} refunded on ${attempt.invoiceNumber} — reported by ${provider}`,
      details: {
        provider: attempt.provider,
        usdCents: amount,
        totalRefundedUsdCents,
      },
    });
    return { kind: 'refund_reconciled', attemptId: attempt.id, usdCents: amount };
  }

  /**
   * Post a refund entry and void the invoice when nothing is left.
   *
   * Shared by the webhook reconciliation and `RefundService`. It does NOT audit:
   * the caller does, because the actor differs — `system` for a refund the
   * provider reported, the named member of staff for one issued here.
   */
  async postRefund(
    executor: SqlExecutor,
    attempt: WebhookAttemptRow,
    amountUsdCents: number,
    idempotencyKey: string,
    actorId: string | null,
  ): Promise<{ totalRefundedUsdCents: number }> {
    // Read first: the entry about to be posted is one of the rows this sums.
    const alreadyRefunded = await this.repo.refundedUsdCents(attempt.id);
    const posted = await this.ledger.post(executor, {
      orgId: attempt.orgId,
      kind: 'refund',
      memo: `${attempt.invoiceNumber} — ${attempt.txnCode}`,
      referenceType: 'payment_attempt',
      referenceId: attempt.id,
      idempotencyKey,
      createdBy: actorId,
      occurredAt: this.now(),
      lines: [
        { accountCode: 'refunds', direction: 'debit', amountUsdCents },
        {
          accountCode: clearingAccountFor(attempt.provider),
          direction: 'credit',
          amountUsdCents,
        },
      ],
    });

    // A duplicate key means the ledger already had this refund: no new money moved.
    const total = posted.duplicated ? alreadyRefunded : alreadyRefunded + amountUsdCents;
    // Fully refunded means the invoice no longer describes money owed or paid.
    if (total >= attempt.usdCents) {
      await this.repo.setInvoiceStatus(attempt.invoiceId, 'void');
    }

    return { totalRefundedUsdCents: total };
  }

  // --------------------------------------------------------- notifications

  /**
   * Receipts and failure notices go out on the `notify` queue's email channel:
   * `NotificationEvent` has no payment member, and inventing one is a schema
   * change this task does not own.
   */
  private async notifyContacts(
    attempt: WebhookAttemptRow,
    template: string,
    vars: Record<string, string>,
  ): Promise<void> {
    if (this.enqueue === undefined) return;
    try {
      const contacts = await this.repo.billingContacts(attempt.orgId);
      for (const contact of contacts) {
        await this.enqueue({
          channel: 'email',
          to: contact.email,
          template,
          vars: {
            invoiceNumber: attempt.invoiceNumber,
            txnCode: attempt.txnCode,
            provider: attempt.provider,
            ...vars,
          },
        });
      }
    } catch (error) {
      // A receipt that cannot be queued must not roll back a captured payment.
      this.warn('could not enqueue a payment notification', error);
    }
  }
}

// ---------------------------------------------------------------- payload reads

/** Stripe: `data.object.id`. Paystack: `data.reference`. */
export function readReference(
  payload: Record<string, unknown>,
  provider: 'stripe' | 'paystack' = 'stripe',
  shape: 'charged' | 'failed' | 'refunded' = 'charged',
): string {
  if (provider === 'paystack') {
    if (shape === 'refunded') {
      const transaction = payload.transaction as { reference?: unknown } | undefined;
      if (typeof transaction?.reference === 'string') return transaction.reference;
    }
    return typeof payload.reference === 'string' ? payload.reference : '';
  }
  // A Stripe refund event carries the intent on the charge object.
  if (shape === 'refunded' && typeof payload.payment_intent === 'string') {
    return payload.payment_intent;
  }
  return typeof payload.id === 'string' ? payload.id : '';
}

/** Both providers report minor units; USD cents are the only amount we accept. */
export function readAmount(
  payload: Record<string, unknown>,
  provider: 'stripe' | 'paystack',
  shape: 'charged' | 'refunded' = 'charged',
): number {
  const field =
    provider === 'stripe'
      ? shape === 'refunded'
        ? 'amount_refunded'
        : 'amount_received'
      : 'amount';
  const value = payload[field];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : Number.NaN;
}

/** Both providers name the field `currency`. */
export function readCurrency(payload: Record<string, unknown>): string {
  const value = payload.currency;
  return typeof value === 'string' ? value : '';
}

/** Stripe: `last_payment_error.code`. Paystack: `gateway_response`. */
export function readFailureReason(
  payload: Record<string, unknown>,
  provider: 'stripe' | 'paystack',
): string {
  if (provider === 'stripe') {
    const failure = payload.last_payment_error as { code?: unknown } | undefined;
    if (typeof failure?.code === 'string' && failure.code !== '') return failure.code;
    return 'payment_failed';
  }
  const gateway = payload.gateway_response;
  return typeof gateway === 'string' && gateway !== '' ? gateway : 'payment_failed';
}

/**
 * One refusal for every verification failure. The provider's own reason code goes
 * in the message, which is what the `WEBHOOK_SIGNATURE_INVALID` audit entry
 * records; the wire code stays `bad_signature` either way.
 */
/**
 * `fastify-raw-body` is configured with `encoding: false`, so the bytes arrive as
 * a Buffer; the plugin's own type also allows a string, and a signature is
 * computed over bytes either way.
 */
function toBuffer(rawBody: Buffer | string | undefined): Buffer | undefined {
  if (rawBody === undefined) return undefined;
  return typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
}

function badSignature(provider: 'stripe' | 'paystack', cause?: unknown): HttpError {
  const reason = isProviderError(cause) ? cause.code : 'missing_signature';
  return new HttpError(
    401,
    'bad_signature',
    `The ${provider} webhook signature did not verify (${reason})`,
  );
}

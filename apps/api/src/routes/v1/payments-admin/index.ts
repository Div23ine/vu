import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audited } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import { LedgerService } from '../../../billing/ledger';
import type { PaymentProviders } from '../../../billing/providers/index';
import { usd } from '../billing/service';
import { WebhookService } from '../webhooks/service';
import { SqlPaymentsRepo, type PaymentsRepo } from './repo';
import {
  ReconcileService,
  RefundService,
  type RefundHandlerResult,
  type RefundResult,
  type ReconcileReport,
} from './service';

/**
 * Payments admin (Task 34): refunds and ledger reconciliation.
 *
 * Both routes are staff-only AND permission-gated AND AAL2 — a refund moves real
 * money, so `requireStaff` (which refuses a first-factor session) is not optional
 * decoration here.
 *
 * The refund is audited through `audited()`: the provider call, the ledger entry,
 * the invoice-status change and the `REFUND_ISSUED` entry all commit together or
 * not at all. Reconciliation is read-only and is deliberately NOT audited; it logs
 * at `info` instead, because running a read is not a change to the platform.
 */

/**
 * Local schemas. The contracts package is owned by Tasks 19/20 and is not in this
 * task's deliverables, so the two admin shapes are declared here and match the
 * catalogue's contract exactly.
 */
const AttemptIdParams = z.object({ attemptId: z.string().uuid() });

const RefundBodySchema = z.object({
  reason: z.string().min(10).max(500),
  amountUsdCents: z.number().int().positive().optional(),
});

const RefundResultSchema = z.object({
  attemptId: z.string().uuid(),
  refundedUsdCents: z.number().int().nonnegative(),
  totalRefundedUsdCents: z.number().int().nonnegative(),
});

const ReconcileReportSchema = z.object({
  checkedEntries: z.number().int().nonnegative(),
  unbalancedEntries: z.array(z.string()),
  attemptsWithoutEntry: z.array(z.string()),
  entriesWithoutAttempt: z.array(z.string()),
  invoicesWithMismatchedStatus: z.array(z.string()),
  ranAt: z.string().datetime(),
});

/** The handler's return; the response schema keeps only `data`. */
interface RefundRouteResult {
  data: RefundResult;
  invoiceNumber: string;
}

export interface PaymentsAdminRoutesOptions {
  /** Test seams. */
  repo?: PaymentsRepo;
  ledger?: Pick<LedgerService, 'post'>;
  payments?: PaymentProviders;
  webhooks?: Pick<WebhookService, 'postRefund'>;
}

function reasonOf(request: FastifyRequest): string {
  return RefundBodySchema.parse(request.body).reason;
}

const paymentsAdminRoutes: FastifyPluginAsync<PaymentsAdminRoutesOptions> = async (
  fastify,
  options,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): PaymentsRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Payments admin is not available');
    }
    return new SqlPaymentsRepo(executor ?? app.db);
  }

  function webhookServiceFor(executor?: SqlExecutor): Pick<WebhookService, 'postRefund'> {
    if (options.webhooks !== undefined) return options.webhooks;
    return new WebhookService({
      repo: repoFor(executor),
      ledger: options.ledger ?? new LedgerService(),
      audit: app.audit,
      payments: app.payments,
    });
  }

  function refundServiceFor(executor?: SqlExecutor): RefundService {
    const payments = options.payments ?? (app.hasDecorator('payments') ? app.payments : undefined);
    if (payments === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Payment providers are not configured');
    }
    return new RefundService({
      repo: repoFor(executor),
      payments,
      webhooks: webhookServiceFor(executor),
    });
  }

  function reconcileServiceFor(): ReconcileService {
    return new ReconcileService({ repo: repoFor() });
  }

  // ---------------------------------------------------------------- refund
  app.post(
    '/admin/payments/:attemptId/refund',
    {
      preHandler: [app.authenticate, app.requireStaff, app.requirePermission('billing:manage')],
      config: { rateLimitPolicy: 'sensitive' },
      schema: {
        params: AttemptIdParams,
        body: RefundBodySchema,
        response: { 200: z.object({ data: RefundResultSchema }) },
      },
    },
    audited<FastifyRequest, RefundRouteResult>(
      {
        eventType: 'REFUND_ISSUED',
        subject: (_req, res) => res.data.attemptId,
        message: (req, res) =>
          `$${usd(res.data.refundedUsdCents)} refunded on ${res.invoiceNumber} — ${reasonOf(req)}`,
        details: (_req, res) => ({
          usdCents: res.data.refundedUsdCents,
          totalRefundedUsdCents: res.data.totalRefundedUsdCents,
        }),
      },
      async (request, _reply, ctx) => {
        const { attemptId } = AttemptIdParams.parse(request.params);
        const body = RefundBodySchema.parse(request.body);
        const actor = request.user;
        if (actor === undefined) throw HttpError.unauthorized();

        const result: RefundHandlerResult = await refundServiceFor(asExecutor(ctx.tx)).refund(
          asExecutor(ctx.tx),
          actor.id,
          attemptId,
          body,
        );
        return {
          data: {
            attemptId: result.attemptId,
            refundedUsdCents: result.refundedUsdCents,
            totalRefundedUsdCents: result.totalRefundedUsdCents,
          },
          invoiceNumber: result.invoiceNumber,
        };
      },
    ),
  );

  // ------------------------------------------------------------- reconcile
  app.post(
    '/admin/payments/reconcile',
    {
      preHandler: [app.authenticate, app.requireStaff, app.requirePermission('billing:manage')],
      config: { rateLimitPolicy: 'sensitive' },
      schema: { response: { 200: z.object({ data: ReconcileReportSchema }) } },
    },
    async (request) => {
      const report: ReconcileReport = await reconcileServiceFor().reconcile();
      // Read-only: logged, not audited. The counts are the point of the run.
      request.log.info(
        {
          checkedEntries: report.checkedEntries,
          unbalanced: report.unbalancedEntries.length,
          attemptsWithoutEntry: report.attemptsWithoutEntry.length,
          entriesWithoutAttempt: report.entriesWithoutAttempt.length,
          invoicesWithMismatchedStatus: report.invoicesWithMismatchedStatus.length,
        },
        'ledger reconciliation run',
      );
      return { data: report };
    },
  );
};

export default fp(paymentsAdminRoutes, { name: 'payments-admin-routes' });

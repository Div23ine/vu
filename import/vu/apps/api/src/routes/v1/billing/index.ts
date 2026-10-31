import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  Invoice,
  InvoiceListQuery,
  PaymentMethodView,
  Subscription,
  UpdatePaymentMethodBody,
} from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { csvDocument } from '../../../billing/csv.js';
import { SqlBillingRepo } from './repo.js';
import { BillingService } from './service.js';

/**
 * Client billing routes (Task 32).
 *
 * Reads need `billing:read`; the only write here needs `billing:manage`. Every
 * query is scoped to the caller's organisation, and a user without one gets
 * `403 no_org` rather than an empty list.
 */

const InvoiceIdParams = z.object({ id: z.string().uuid() });

function orgIdOf(request: FastifyRequest): string {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  if (user.orgId === null || user.orgId === undefined) {
    throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
  }
  return user.orgId;
}

function actorOf(request: FastifyRequest): { id: string; email: string } {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  return { id: user.id, email: user.email };
}

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /** Built lazily, and per transaction so a write and its audit share one. */
  function serviceFor(executor?: SqlExecutor): BillingService {
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Billing is not available');
    }
    return new BillingService({
      repo: new SqlBillingRepo(executor ?? app.db),
      payments: app.hasDecorator('payments') ? app.payments : undefined,
      storage: app.hasDecorator('storage') ? app.storage : undefined,
      enqueuePdf: async (job) => {
        await app.queues.pdf.add('invoice', job);
      },
    });
  }

  // ----------------------------------------------------------- subscription
  app.get(
    '/billing/subscription',
    {
      preHandler: [app.authenticate, app.requirePermission('billing:read')],
      schema: { response: { 200: z.object({ data: Subscription }) } },
    },
    async (request) => ({ data: await serviceFor().subscription(orgIdOf(request)) }),
  );

  // --------------------------------------------------------- payment method
  app.get(
    '/billing/payment-method',
    {
      preHandler: [app.authenticate, app.requirePermission('billing:read')],
      schema: { response: { 200: z.object({ data: PaymentMethodView }) } },
    },
    async (request) => ({ data: await serviceFor().paymentMethod(orgIdOf(request)) }),
  );

  const putHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = UpdatePaymentMethodBody.parse(request.body);
    const orgId = orgIdOf(request);
    const actor = actorOf(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const updated = await serviceFor(executor).updatePaymentMethod(orgId, body);
      await app.audit.append(executor, {
        eventType: 'PAYMENT_METHOD_UPDATED',
        actor: { id: actor.id, label: actor.email.split('@')[0] ?? actor.email },
        subject: orgId,
        message: `${actor.email} updated the payment method`,
        // Brand and last four only. The token and the cardholder's name are not
        // audit material.
        details: { brand: updated.brand, last4: updated.last4 },
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: result.view });
  };
  (putHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.put('/billing/payment-method', {
    preHandler: [app.authenticate, app.requirePermission('billing:manage')],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: UpdatePaymentMethodBody,
      response: { 200: z.object({ data: PaymentMethodView }) },
    },
    handler: putHandler,
  });

  // ---------------------------------------------------------------- invoices
  app.get(
    '/billing/invoices',
    {
      preHandler: [app.authenticate, app.requirePermission('billing:read')],
      schema: {
        querystring: InvoiceListQuery,
        response: { 200: z.object({ data: z.array(Invoice), total: z.number() }) },
      },
    },
    async (request) => {
      const query = InvoiceListQuery.parse(request.query);
      return serviceFor().invoices(orgIdOf(request), query);
    },
  );

  app.get(
    '/billing/invoices/:id/pdf',
    {
      preHandler: [app.authenticate, app.requirePermission('billing:read')],
      schema: {
        params: InvoiceIdParams,
        response: { 202: z.object({ data: z.object({ status: z.literal('generating') }) }) },
      },
    },
    async (request, reply) => {
      const { id } = InvoiceIdParams.parse(request.params);
      const result = await serviceFor().invoicePdf(orgIdOf(request), id);
      if (result.kind === 'generating') {
        return reply.status(202).send({ data: { status: 'generating' } });
      }
      // A binary body is not expressible in the JSON response schema, so the
      // typed reply is bypassed for the PDF branch only.
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .header('Cache-Control', 'private, no-store')
        .send(Buffer.from(result.body) as never);
      return reply as never;
    },
  );

  // The CSV export is a static path, registered after `:id/pdf` so Fastify does
  // not treat `invoices.csv` as an invoice id.
  app.get(
    '/billing/invoices.csv',
    {
      preHandler: [app.authenticate, app.requirePermission('billing:read')],
    },
    async (request, reply) => {
      const rows = await serviceFor().invoiceCsvRows(orgIdOf(request));
      const csv = csvDocument([...BillingService.csvHeader], rows);
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="invoices.csv"')
        .header('Cache-Control', 'private, no-store')
        .send(csv);
    },
  );
};

export default fp(billingRoutes, { name: 'billing-routes' });

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  DownloadUrlResponse,
  EntitlementView,
  ProductView,
  PurchaseBody,
  PurchaseResponse,
} from '@vunvault/contracts';
import { audited } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import { InvoiceIssuer } from '../../../billing/invoice-issuer';
import { SqlStoreRepo, type StoreRepo } from './repo';
import { EntitlementService, StoreService, type AuditInstruction } from './service';

/**
 * The public store (Task 40c).
 *
 * The catalogue and a product page are public and cacheable. Buying is not: it needs
 * a session, `billing:manage` and an organisation, because it issues an invoice
 * against that organisation. Downloads are the sensitive one — a presigned URL is a
 * bearer credential, so that route is rate-limited and audited.
 */

const ProductIdParams = z.object({ id: z.string().uuid() });
const ProductSlugParams = z.object({ slug: z.string().min(1) });
const EntitlementIdParams = z.object({ id: z.string().uuid() });

/** Public reads are cached at the edge for five minutes. */
export const PRODUCT_CACHE_CONTROL = 'public, max-age=300';

export interface StoreRoutesOptions {
  /** Test seams. */
  repo?: StoreRepo;
  issuer?: Pick<InvoiceIssuer, 'issue'>;
  storage?: ObjectStorage;
  entitlements?: Pick<EntitlementService, 'list' | 'downloadUrl'>;
  contactsFor?: (orgId: string) => Promise<string[]>;
}

function orgIdOf(request: FastifyRequest): string {
  const user = request.user;
  if (user === undefined) throw HttpError.unauthorized();
  if (user.orgId === null || user.orgId === undefined) {
    throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
  }
  return user.orgId;
}

const storeRoutes: FastifyPluginAsync<StoreRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): StoreRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'The store is not available');
    }
    return new SqlStoreRepo(executor ?? app.db);
  }

  function storeFor(executor?: SqlExecutor): StoreService {
    return new StoreService({
      repo: repoFor(executor),
      executor,
      issuer: options.issuer ?? new InvoiceIssuer(),
    });
  }

  function entitlementsFor(executor?: SqlExecutor): EntitlementService {
    return new EntitlementService({
      repo: repoFor(executor),
      audit: app.hasDecorator('audit') ? app.audit : undefined,
      storage: options.storage ?? (app.hasDecorator('storage') ? app.storage : undefined),
      contactsFor: options.contactsFor,
      enqueueEmail: app.hasDecorator('queues')
        ? async (payload) => {
            await app.queues.notify.add('email', { channel: 'email', ...payload });
          }
        : undefined,
    });
  }

  // -------------------------------------------------------------- catalogue
  app.get(
    '/products',
    {
      schema: {
        response: { 200: z.object({ data: z.array(ProductView), total: z.number() }) },
      },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', PRODUCT_CACHE_CONTROL);
      return storeFor().list();
    },
  );

  app.get(
    '/products/:slug',
    {
      schema: {
        params: ProductSlugParams,
        response: { 200: z.object({ data: ProductView }) },
      },
    },
    async (request, reply) => {
      const { slug } = ProductSlugParams.parse(request.params);
      reply.header('Cache-Control', PRODUCT_CACHE_CONTROL);
      return { data: await storeFor().bySlug(slug) };
    },
  );

  // --------------------------------------------------------------- purchase
  app.post(
    '/products/:id/purchase',
    {
      preHandler: [app.authenticate, app.requirePermission('billing:manage')],
      config: { rateLimitPolicy: 'sensitive' },
      schema: {
        params: ProductIdParams,
        body: PurchaseBody,
        response: { 201: PurchaseResponse },
      },
    },
    audited<FastifyRequest, { data: PurchaseResponse['data']; audit: AuditInstruction[] }>(
      {
        eventType: 'PRODUCT_PURCHASE_STARTED',
        subject: (_req, res) => res.data.invoiceId,
        message: (_req, res) => res.audit[0]?.message ?? 'Product purchase started',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, reply, ctx) => {
        const { id } = ProductIdParams.parse(request.params);
        const body = PurchaseBody.parse(request.body);
        // Two ids in one request must agree, or the client does not know what it
        // is buying.
        if (body.productId !== id) {
          throw HttpError.badRequest('validation_failed', [
            { path: ['productId'], message: 'The body and the path name different products' },
          ]);
        }
        const result = await storeFor(asExecutor(ctx.tx)).purchase(orgIdOf(request), id);
        reply.status(201);
        return { data: result.data, audit: result.audit };
      },
    ),
  );

  // ---------------------------------------------------------- entitlements
  app.get(
    '/entitlements',
    {
      preHandler: [app.authenticate],
      schema: {
        response: { 200: z.object({ data: z.array(EntitlementView), total: z.number() }) },
      },
    },
    async (request) => {
      const data = await entitlementsFor().list(orgIdOf(request));
      return { data, total: data.length };
    },
  );

  app.post(
    '/entitlements/:id/download-url',
    {
      preHandler: [app.authenticate],
      config: { rateLimitPolicy: 'sensitive' },
      schema: { params: EntitlementIdParams, response: { 200: DownloadUrlResponse } },
    },
    audited<
      FastifyRequest,
      { data: { url: string; expiresAt: string }; audit: AuditInstruction[] }
    >(
      {
        eventType: 'PRODUCT_DOWNLOADED',
        subject: (_req, res) => res.audit[0]?.subject,
        message: (_req, res) => res.audit[0]?.message ?? 'Product download issued',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request) => {
        const { id } = EntitlementIdParams.parse(request.params);
        const result = await entitlementsFor().downloadUrl(orgIdOf(request), id);
        return {
          data: { url: result.url, expiresAt: result.expiresAt },
          audit: result.audit,
        };
      },
    ),
  );
};

export default fp(storeRoutes, { name: 'store-routes' });

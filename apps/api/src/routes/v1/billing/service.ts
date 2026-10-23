import type {
  Invoice,
  PaymentMethodView,
  Subscription,
  UpdatePaymentMethodBody,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import type { PaymentProviders } from '../../../billing/providers/index';
import { INVOICE_CSV_HEADER } from '../../../billing/csv';
import type { BillingRepo, InvoiceRow } from './repo';

/**
 * Client billing: subscription, payment method and invoices.
 *
 * Two rules shape every method. Amounts are USD cents and are read from the ledger
 * view, never computed here. And a provider token is stored exactly once, as
 * `provider_payment_method_id` — it is never logged, never audited and never
 * echoed in a response.
 */

export interface BillingServiceDeps {
  repo: BillingRepo;
  payments?: PaymentProviders;
  storage?: ObjectStorage;
  /** Enqueues `{ kind: 'invoice', refId }` on the `pdf` queue. */
  enqueuePdf?: (job: { kind: 'invoice'; refId: string }) => Promise<void>;
  /** Test seam for fetching a rendered PDF from storage. */
  fetchImpl?: typeof fetch;
  randomUuid?: () => string;
}

export interface PdfResult {
  kind: 'stream';
  body: ArrayBuffer;
  filename: string;
}

export interface GeneratingResult {
  kind: 'generating';
}

export const PDF_EXPIRES_SECONDS = 60;

export class BillingService {
  private readonly repo: BillingRepo;
  private readonly payments: PaymentProviders | undefined;
  private readonly storage: ObjectStorage | undefined;
  private readonly enqueuePdf:
    ((job: { kind: 'invoice'; refId: string }) => Promise<void>) | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly randomUuid: () => string;

  constructor(deps: BillingServiceDeps) {
    this.repo = deps.repo;
    this.payments = deps.payments;
    this.storage = deps.storage;
    this.enqueuePdf = deps.enqueuePdf;
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
  }

  async subscription(orgId: string): Promise<Subscription> {
    const row = await this.repo.getSubscription(orgId);
    if (row === null) throw HttpError.notFound();
    return {
      id: row.id,
      planName: row.planName,
      status: row.status as Subscription['status'],
      billingCycle: row.billingCycle as Subscription['billingCycle'],
      amountUsdCents: row.amountUsdCents,
      // Settlement is USD; anything else in the row is a bug, not a feature.
      settlementCurrency: 'USD',
      renewsOn: row.renewsOn,
      description: row.description,
    };
  }

  async paymentMethod(orgId: string): Promise<PaymentMethodView> {
    const row = await this.repo.getDefaultPaymentMethod(orgId);
    if (row === null) throw HttpError.notFound();
    return toView(row);
  }

  /**
   * Replaces the default payment method. The browser has already tokenised the
   * card, so this method only ever handles a token — never a PAN or a CVC.
   *
   * Changes apply from the next billing cycle: the current invoice keeps the
   * method it was issued with.
   */
  async updatePaymentMethod(
    orgId: string,
    body: UpdatePaymentMethodBody,
  ): Promise<{ view: PaymentMethodView; brand: string; last4: string }> {
    const organization = await this.repo.getOrganization(orgId);
    if (organization === null) {
      throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
    }
    if (this.payments === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Payment providers are not configured');
    }

    const idempotencyKey = this.randomUuid();
    let providerPaymentMethodId: string;
    let details: { brand: string; last4: string; expMonth: number; expYear: number };

    try {
      if (body.provider === 'stripe') {
        // A Stripe customer is created once per organisation and reused.
        let customerId = organization.stripeCustomerId;
        if (customerId === null) {
          const created = await this.payments.stripe.createCustomer({
            email: organization.email,
            name: organization.name,
            metadata: { orgId },
            idempotencyKey: `cust:${idempotencyKey}`,
          });
          customerId = created.id;
          await this.repo.setStripeCustomerId(orgId, customerId);
        }
        await this.payments.stripe.attachPaymentMethod(
          body.providerPaymentMethodToken,
          customerId,
          `attach:${idempotencyKey}`,
        );
        await this.payments.stripe.setDefaultPaymentMethod(
          customerId,
          body.providerPaymentMethodToken,
          `default:${idempotencyKey}`,
        );
        details = await this.payments.stripe.retrievePaymentMethod(body.providerPaymentMethodToken);
        providerPaymentMethodId = body.providerPaymentMethodToken;
      } else {
        // Paystack returns the reusable authorisation with the verified
        // transaction; that authorisation code is what gets stored.
        const verified = await this.payments.paystack.verifyTransaction(
          body.providerPaymentMethodToken,
        );
        const authorization = verified.authorization ?? {};
        const reference = authorization.authorization_code ?? body.providerPaymentMethodToken;
        details = {
          brand: authorization.card_type ?? 'card',
          last4: authorization.last4 ?? '',
          expMonth: Number(authorization.exp_month ?? 0),
          expYear: Number(authorization.exp_year ?? 0),
        };
        if (organization.paystackCustomerCode === null) {
          await this.repo.setPaystackCustomerCode(orgId, reference);
        }
        providerPaymentMethodId = reference;
      }
    } catch (error) {
      // The provider refused the token. Its message is not forwarded: it can carry
      // card metadata, and the client already knows what it submitted.
      if ((error as { name?: string }).name === 'ProviderError') {
        throw new HttpError(422, 'payment_method_rejected', 'That payment method was declined');
      }
      throw error;
    }

    // The previous default is demoted and detached best-effort: a failure to
    // detach must not leave the client without a usable card.
    const previous = await this.repo.clearDefaultPaymentMethods(orgId);
    for (const method of previous) {
      if (
        method.provider === 'stripe' &&
        method.providerPaymentMethodId !== providerPaymentMethodId
      ) {
        await this.payments.stripe
          .detachPaymentMethod(method.providerPaymentMethodId, `detach:${idempotencyKey}`)
          .catch(() => undefined);
      }
    }

    const row = await this.repo.insertPaymentMethod(orgId, {
      provider: body.provider,
      providerPaymentMethodId,
      brand: details.brand,
      last4: details.last4,
      expMonth: details.expMonth,
      expYear: details.expYear,
      cardholderName: body.cardholderName,
      billingCountry: body.billingCountry,
    });
    return { view: toView(row), brand: row.brand, last4: row.last4 };
  }

  async invoices(
    orgId: string,
    query: { page: number; pageSize: number; status?: string },
  ): Promise<{ data: Invoice[]; total: number }> {
    const result = await this.repo.listInvoices(orgId, query);
    return { data: result.rows.map(toInvoice), total: result.total };
  }

  async invoice(orgId: string, invoiceId: string): Promise<Invoice> {
    const row = await this.repo.getInvoice(orgId, invoiceId);
    if (row === null) throw HttpError.notFound();
    return toInvoice(row);
  }

  /**
   * Streams a rendered PDF when the worker has produced one, otherwise queues the
   * render and tells the client to come back. Rendering is never done inline: it is
   * slow, and a client refreshing the page must not pile up workers.
   */
  async invoicePdf(orgId: string, invoiceId: string): Promise<PdfResult | GeneratingResult> {
    const row = await this.repo.getInvoice(orgId, invoiceId);
    if (row === null) throw HttpError.notFound();

    if (row.pdfObjectKey !== null && this.storage !== undefined) {
      const url = await this.storage.presignGet({
        key: row.pdfObjectKey,
        expiresSec: PDF_EXPIRES_SECONDS,
      });
      const response = await this.fetchImpl(url);
      if (!response.ok) {
        throw new HttpError(502, 'upstream_error', 'The invoice file could not be retrieved');
      }
      return {
        kind: 'stream',
        body: await response.arrayBuffer(),
        filename: `${row.number}.pdf`,
      };
    }

    if (this.enqueuePdf !== undefined) {
      await this.enqueuePdf({ kind: 'invoice', refId: invoiceId });
    }
    return { kind: 'generating' };
  }

  /** Every invoice the organisation has, oldest first, for the CSV export. */
  async invoiceCsvRows(orgId: string): Promise<Array<Array<string | number>>> {
    const rows: InvoiceRow[] = [];
    let page = 1;
    for (;;) {
      const result = await this.repo.listInvoices(orgId, { page, pageSize: 200 });
      rows.push(...result.rows);
      if (rows.length >= result.total || result.rows.length === 0) break;
      page += 1;
    }
    rows.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));

    return rows.map((row) => [
      row.number,
      row.issuedAt.slice(0, 10),
      row.title,
      row.status,
      usd(row.totalUsdCents),
    ]);
  }

  static readonly csvHeader: readonly string[] = INVOICE_CSV_HEADER;
}

/** Cents to a fixed two-decimal USD string for the export. */
export function usd(cents: number): string {
  return (cents / 100).toFixed(2);
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    issuedAt: row.issuedAt,
    title: row.title,
    detail: row.detail,
    totalUsdCents: row.totalUsdCents,
    paidUsdCents: row.paidUsdCents,
    outstandingUsdCents: row.outstandingUsdCents,
    status: row.status as Invoice['status'],
    settlementCurrency: 'USD',
    pdfAvailable: row.pdfObjectKey !== null,
  };
}

function toView(row: {
  id: string;
  provider: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string | null;
  billingCountry: string | null;
}): PaymentMethodView {
  return {
    id: row.id,
    provider: row.provider as PaymentMethodView['provider'],
    brand: row.brand,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    cardholderName: row.cardholderName,
    billingCountry: row.billingCountry,
  };
}

export { toView as toPaymentMethodView };

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ProviderError } from '../../providers/error.js';

/**
 * Stripe REST client.
 *
 * Built on the global `fetch` rather than the SDK: the surface the platform needs
 * is a dozen endpoints, and pulling the SDK in would add a dependency whose
 * transitive weight is not justified. Every POST carries an `Idempotency-Key`, so
 * a retry after a timeout can never charge a client twice.
 *
 * Settlement is USD. `currency=usd` is written into the PaymentIntent here rather
 * than accepted from a caller, so no code path can send another currency.
 */

export const STRIPE_BASE_URL = 'https://api.stripe.com/v1';
export const STRIPE_CURRENCY = 'usd';
export const DEFAULT_TIMEOUT_MS = 8_000;
/** Stripe's default tolerance for a webhook timestamp. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface StripeClientOptions {
  secretKey: string;
  webhookSecret?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export interface CardDetails {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface PaymentIntentInput {
  amountUsdCents: number;
  customerId: string;
  paymentMethodId?: string;
  idempotencyKey: string;
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export class StripeClient {
  private readonly secretKey: string;
  private readonly webhookSecret: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: StripeClientOptions) {
    this.secretKey = options.secretKey;
    this.webhookSecret = options.webhookSecret;
    this.baseUrl = options.baseUrl ?? STRIPE_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createCustomer(input: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
  }): Promise<{ id: string }> {
    const form = new URLSearchParams({ email: input.email });
    if (input.name !== undefined) form.set('name', input.name);
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      form.set(`metadata[${key}]`, value);
    }
    const result = await this.request<{ id: string }>('/customers', form, input.idempotencyKey);
    return { id: result.id };
  }

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.request(
      `/payment_methods/${encodeURIComponent(paymentMethodId)}/attach`,
      new URLSearchParams({ customer: customerId }),
      idempotencyKey,
    );
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.request(
      `/customers/${encodeURIComponent(customerId)}`,
      new URLSearchParams({ invoice_settings: '' }).toString() === ''
        ? new URLSearchParams({ 'invoice_settings[default_payment_method]': paymentMethodId })
        : new URLSearchParams({ 'invoice_settings[default_payment_method]': paymentMethodId }),
      idempotencyKey,
    );
  }

  async retrievePaymentMethod(paymentMethodId: string): Promise<CardDetails> {
    const result = await this.request<{
      card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
    }>(`/payment_methods/${encodeURIComponent(paymentMethodId)}`, undefined, undefined, 'GET');
    const card = result.card ?? {};
    return {
      brand: card.brand ?? 'unknown',
      last4: card.last4 ?? '',
      expMonth: card.exp_month ?? 0,
      expYear: card.exp_year ?? 0,
    };
  }

  async detachPaymentMethod(paymentMethodId: string, idempotencyKey: string): Promise<void> {
    await this.request(
      `/payment_methods/${encodeURIComponent(paymentMethodId)}/detach`,
      new URLSearchParams(),
      idempotencyKey,
    );
  }

  /**
   * Creates and confirms a PaymentIntent in USD. Redirects are disabled unless a
   * `returnUrl` is supplied: a 3-D Secure redirect is the caller's decision, not a
   * default.
   */
  async createPaymentIntent(input: PaymentIntentInput): Promise<{
    id: string;
    status: string;
    clientSecret: string | null;
    amountUsdCents: number;
  }> {
    const form = new URLSearchParams({
      amount: String(input.amountUsdCents),
      currency: STRIPE_CURRENCY,
      customer: input.customerId,
      confirm: 'true',
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]':
        input.returnUrl === undefined ? 'never' : 'always',
    });
    if (input.paymentMethodId !== undefined) form.set('payment_method', input.paymentMethodId);
    if (input.returnUrl !== undefined) form.set('return_url', input.returnUrl);
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      form.set(`metadata[${key}]`, value);
    }

    const result = await this.request<{
      id: string;
      status: string;
      client_secret?: string;
      amount: number;
      currency: string;
    }>('/payment_intents', form, input.idempotencyKey);
    return {
      id: result.id,
      status: result.status,
      clientSecret: result.client_secret ?? null,
      amountUsdCents: result.amount,
    };
  }

  async refund(input: {
    paymentIntentId: string;
    amountUsdCents: number;
    idempotencyKey: string;
  }): Promise<{ id: string; status: string }> {
    const result = await this.request<{ id: string; status: string }>(
      '/refunds',
      new URLSearchParams({
        payment_intent: input.paymentIntentId,
        amount: String(input.amountUsdCents),
      }),
      input.idempotencyKey,
    );
    return { id: result.id, status: result.status };
  }

  /**
   * Verifies a Stripe webhook signature (`t=<unix>,v1=<hex>` over `<t>.<body>`)
   * with a constant-time comparison, and rejects a timestamp outside the
   * tolerance so a captured request cannot be replayed later.
   */
  verifyWebhook(
    rawBody: Buffer,
    signatureHeader: string,
    toleranceSec: number = WEBHOOK_TOLERANCE_SECONDS,
    now: Date = new Date(),
  ): StripeWebhookEvent {
    if (this.webhookSecret === undefined) {
      throw new ProviderError('webhook_secret_missing', 'No Stripe webhook secret configured');
    }
    const parts = Object.fromEntries(
      signatureHeader
        .split(',')
        .map((part) => part.split('='))
        .filter((pair) => pair.length === 2)
        .map(([key, value]) => [key as string, value as string]),
    );
    const timestamp = parts.t;
    const signatures = signatureHeader
      .split(',')
      .filter((part) => part.startsWith('v1='))
      .map((part) => part.slice(3));
    if (timestamp === undefined || signatures.length === 0) {
      throw new ProviderError('invalid_signature', 'Malformed Stripe signature header');
    }

    const age = Math.abs(now.getTime() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > toleranceSec) {
      throw new ProviderError('timestamp_outside_tolerance', 'Stripe webhook timestamp is too old');
    }

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const signed = signatures.some((signature) => {
      const candidate = Buffer.from(signature, 'hex');
      return (
        candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer)
      );
    });
    if (!signed) {
      throw new ProviderError('invalid_signature', 'Stripe webhook signature did not match');
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as StripeWebhookEvent;
    } catch {
      throw new ProviderError('invalid_payload', 'Stripe webhook body was not JSON');
    }
  }

  private async request<T>(
    path: string,
    body: URLSearchParams | undefined,
    idempotencyKey: string | undefined,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      Accept: 'application/json',
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = body.toString();
    }
    if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;

    const response = await this.send(init, path);
    const text = await response.text();
    if (!response.ok) {
      // A 5xx or a rate limit is worth another attempt; a 4xx is not.
      const retryable = response.status >= 500 || response.status === 429;
      throw new ProviderError(
        `stripe_${response.status}`,
        text.slice(0, 500) || `Stripe responded ${response.status}`,
        { retryable },
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ProviderError('invalid_response', 'Stripe returned a non-JSON body');
    }
  }

  private async send(init: RequestInit, path: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = (error as { name?: string }).name === 'AbortError';
      throw new ProviderError(
        aborted ? 'timeout' : 'network_error',
        aborted ? `Stripe request timed out after ${this.timeoutMs} ms` : 'Stripe request failed',
        { retryable: true },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

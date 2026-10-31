import { createHmac, timingSafeEqual } from 'node:crypto';
import { ProviderError } from '../../providers/error.js';

/**
 * Paystack REST client.
 *
 * Paystack speaks JSON and signs webhooks with HMAC-SHA512 of the raw body using
 * the secret key. Amounts are sent in the settlement currency's minor unit — for
 * USD that is cents, and `currency` is always `USD`.
 */

export const PAYSTACK_BASE_URL = 'https://api.paystack.co';
export const PAYSTACK_CURRENCY = 'USD';
export const DEFAULT_TIMEOUT_MS = 8_000;

export interface PaystackClientOptions {
  secretKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export interface PaystackTransaction {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  channel: string | null;
  authorization?: {
    authorization_code?: string;
    card_type?: string;
    last4?: string;
    exp_month?: string;
    exp_year?: string;
    bank?: string;
  };
}

export class PaystackClient {
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PaystackClientOptions) {
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl ?? PAYSTACK_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async initializeTransaction(input: {
    email: string;
    amountUsdCents: number;
    reference: string;
    channels?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
    const result = await this.request<{
      data: { authorization_url: string; access_code: string; reference: string };
    }>('/transaction/initialize', {
      email: input.email,
      // Minor units of the settlement currency: cents for USD.
      amount: input.amountUsdCents,
      currency: PAYSTACK_CURRENCY,
      reference: input.reference,
      channels: input.channels ?? ['card'],
      metadata: input.metadata ?? {},
    });
    return {
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference: result.data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<PaystackTransaction> {
    const result = await this.request<{ data: PaystackTransaction }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      undefined,
      'GET',
    );
    return result.data;
  }

  async refund(input: {
    transaction: string;
    amountUsdCents: number;
  }): Promise<{ id: string; status: string }> {
    const result = await this.request<{ data: { id: string; status: string } }>('/refund', {
      transaction: input.transaction,
      amount: input.amountUsdCents,
      currency: PAYSTACK_CURRENCY,
    });
    return { id: result.data.id, status: result.data.status };
  }

  /**
   * Paystack signs the raw body with HMAC-SHA512 and sends the hex digest in
   * `x-paystack-signature`. The comparison is constant-time.
   */
  verifyWebhook(rawBody: Buffer, signatureHeader: string): Record<string, unknown> {
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const candidate = Buffer.from(signatureHeader.trim(), 'hex');
    if (candidate.length !== expectedBuffer.length || !timingSafeEqual(candidate, expectedBuffer)) {
      throw new ProviderError('invalid_signature', 'Paystack webhook signature did not match');
    }
    try {
      return JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new ProviderError('invalid_payload', 'Paystack webhook body was not JSON');
    }
  }

  private async request<T>(
    path: string,
    body: unknown,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      Accept: 'application/json',
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      // The reference doubles as the idempotency key: Paystack deduplicates on it.
      const reference = (body as { reference?: string }).reference;
      if (reference !== undefined) headers['Idempotency-Key'] = reference;
      init.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = (error as { name?: string }).name === 'AbortError';
      throw new ProviderError(
        aborted ? 'timeout' : 'network_error',
        aborted
          ? `Paystack request timed out after ${this.timeoutMs} ms`
          : 'Paystack request failed',
        { retryable: true },
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        `paystack_${response.status}`,
        text.slice(0, 500) || `Paystack responded ${response.status}`,
        { retryable: response.status >= 500 || response.status === 429 },
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ProviderError('invalid_response', 'Paystack returned a non-JSON body');
    }
  }
}

/**
 * Email provider — Resend over plain `fetch`.
 *
 * No vendor SDK: one POST, an 8-second timeout, and no retry inside the provider.
 * Retries are BullMQ's job (`notify` queue, three attempts, exponential backoff),
 * so a provider must fail fast and classify honestly.
 */
import { ProviderError } from './error.js';

export const RESEND_URL = 'https://api.resend.com/emails';
export const DEFAULT_FROM = 'VUNVAULT <no-reply@info.vunvault.com>';
export const PROVIDER_TIMEOUT_MS = 8000;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string }>;
}

interface ResendResponse {
  id?: string;
  message?: string;
}

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, fetchImpl: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async send(message: EmailMessage): Promise<{ id: string }> {
    let response: Response;
    try {
      response = await this.fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from ?? DEFAULT_FROM,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      // Timeout or network failure: the job is retried by the queue.
      throw new ProviderError('email_unavailable', 'Resend did not respond in time', {
        retryable: true,
      });
    }

    const payload = (await response.json().catch(() => ({}))) as ResendResponse;

    if (response.status >= 500) {
      throw new ProviderError('email_unavailable', 'Resend is unavailable', { retryable: true });
    }
    if (!response.ok) {
      // A rejected recipient, template or sender will fail again — do not retry.
      throw new ProviderError('email_rejected', payload.message ?? 'Resend rejected the message');
    }
    if (payload.id === undefined) {
      throw new ProviderError('email_rejected', 'Resend accepted the message without an id');
    }
    return { id: payload.id };
  }
}

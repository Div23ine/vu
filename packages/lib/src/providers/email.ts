/**
 * Email provider — Resend over plain `fetch`.
 *
 * No vendor SDK: one POST, an 8-second timeout, and no retry inside the provider.
 * Retries are BullMQ's job (`notify` queue, three attempts, exponential backoff),
 * so a provider must fail fast and classify honestly.
 *
 * Revision 2 addendum, A2 — the delivery contract:
 *
 *   1. every send is AWAITED and its outcome is inspected; nothing is
 *      fire-and-forget, and no path resolves successfully without a Resend `id`;
 *   2. the full response `{ id, status, error }` plus the inbound request id is
 *      logged — at `info` on success, at `error` on failure — so a "sent" claim
 *      is always traceable to a Resend event an operator can look up;
 *   3. failures THROW. The caller turns them into a generic user-facing answer
 *      (`500 internal_error`); the Resend detail stays in the logs, so a
 *      rejection can never leak a recipient's registration status;
 *   4. the recipient address and the message body are never logged.
 */
import { ProviderError } from './error';

export const RESEND_URL = 'https://api.resend.com/emails';
/** The domain Resend must have verified for this address, or delivery is refused. */
export const DEFAULT_FROM = 'VUNVAULT <no-reply@vunvault.com>';
export const PROVIDER_TIMEOUT_MS = 8000;

/** Resend's domain list, used by the boot-time from-domain guard (A2.3). */
export const RESEND_DOMAINS_URL = 'https://api.resend.com/domains';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Correlation context for one send. Carried into the log line and nothing else —
 * deliberately NOT the recipient, which must never reach the logs from here.
 */
export interface EmailSendContext {
  /** The inbound `x-request-id`, so a log line ties to one HTTP request. */
  requestId?: string;
  /** Which flow asked for the mail (`magic_link`, `signup_otp`, `diagnostics`). */
  purpose?: string;
}

/** The narrow pino-compatible surface the provider logs through. */
export interface EmailLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface EmailProvider {
  send(message: EmailMessage, context?: EmailSendContext): Promise<{ id: string }>;
}

interface ResendResponse {
  id?: string;
  message?: string;
  /** Resend returns `name` on some error shapes (`missing_api_key`, …). */
  name?: string;
  statusCode?: number;
}

/** Pull the bare domain out of a `Name <addr@domain>` or `addr@domain` from header. */
export function fromDomain(from: string): string | null {
  const match = /@([A-Za-z0-9.-]+)\s*>?$/.exec(from.trim());
  const domain = match?.[1];
  return domain === undefined ? null : domain.toLowerCase();
}

/**
 * Local, offline sanity check on the configured sender (A2.3).
 *
 * Resend accepts a request for an unverified domain and then refuses DELIVERY —
 * the exact "dashboard shows nothing / mailbox stays empty" class of failure this
 * addendum exists to kill. A placeholder or unqualified domain is caught here
 * without a network call; `verifyFromDomainIsRegistered` does the authoritative
 * check against Resend.
 */
export function assertPlausibleFromAddress(from: string): void {
  const domain = fromDomain(from);
  if (domain === null) {
    throw new ProviderError('email_misconfigured', `EMAIL_FROM has no domain: "${from}"`);
  }
  if (!domain.includes('.') || domain.endsWith('.local') || domain === 'example.com') {
    throw new ProviderError(
      'email_misconfigured',
      `EMAIL_FROM domain "${domain}" is not a deliverable domain`,
    );
  }
}

export interface ResendDomain {
  name?: string;
  status?: string;
}

/**
 * Ask Resend whether the sender's domain is verified (A2.3).
 *
 * Returns the domain's status, or `null` when Resend could not be consulted at
 * all (network failure, non-2xx, unexpected shape). `null` is NOT "unverified" —
 * the caller decides whether an unreachable control plane should block a boot,
 * and it should not: taking the whole platform down because Resend's management
 * API blipped is a worse outcome than logging loudly and continuing.
 */
export async function fetchResendDomainStatus(
  apiKey: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetchImpl(RESEND_DOMAINS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => ({}))) as { data?: ResendDomain[] };
  const match = (payload.data ?? []).find(
    (entry) => (entry.name ?? '').toLowerCase() === domain.toLowerCase(),
  );
  return match?.status ?? null;
}

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly log: EmailLogger | undefined;

  constructor(apiKey: string, fetchImpl: typeof fetch = fetch, log?: EmailLogger) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.log = log;
  }

  /**
   * Send one message and return the Resend id.
   *
   * Every exit is either a returned id or a thrown `ProviderError`: there is no
   * path that resolves without proof Resend accepted the message.
   */
  async send(message: EmailMessage, context: EmailSendContext = {}): Promise<{ id: string }> {
    const startedAt = Date.now();
    const fields = {
      provider: 'resend',
      purpose: context.purpose ?? 'unspecified',
      requestId: context.requestId ?? null,
      from: message.from ?? DEFAULT_FROM,
    };

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
    } catch (error) {
      // Timeout or network failure: the job is retried by the queue.
      const reason = error instanceof Error ? error.message : String(error);
      this.log?.error(
        { ...fields, status: null, id: null, error: reason, durationMs: Date.now() - startedAt },
        'resend did not respond — message NOT delivered',
      );
      throw new ProviderError('email_unavailable', 'Resend did not respond in time', {
        retryable: true,
      });
    }

    const payload = (await response.json().catch(() => ({}))) as ResendResponse;
    const durationMs = Date.now() - startedAt;

    if (response.status >= 500) {
      this.log?.error(
        { ...fields, status: response.status, id: null, error: payload.message ?? null, durationMs },
        'resend is unavailable — message NOT delivered',
      );
      throw new ProviderError('email_unavailable', 'Resend is unavailable', { retryable: true });
    }
    if (!response.ok) {
      // A rejected recipient, template or sender will fail again — do not retry.
      const detail = payload.message ?? payload.name ?? 'Resend rejected the message';
      this.log?.error(
        { ...fields, status: response.status, id: null, error: detail, durationMs },
        'resend rejected the message — NOT delivered',
      );
      throw new ProviderError('email_rejected', detail);
    }
    if (payload.id === undefined) {
      // A 2xx with no id is NOT a success: there is nothing to look up in the
      // dashboard, so treating it as sent would recreate the original bug.
      this.log?.error(
        {
          ...fields,
          status: response.status,
          id: null,
          error: 'response carried no id',
          durationMs,
        },
        'resend returned 2xx without an id — treating as NOT delivered',
      );
      throw new ProviderError('email_rejected', 'Resend accepted the message without an id');
    }

    // A2.2: the successful send is logged with the id an operator can search the
    // Resend dashboard for. `info`, so it is present at the production default.
    this.log?.info(
      { ...fields, status: response.status, id: payload.id, error: null, durationMs },
      'resend accepted the message',
    );
    return { id: payload.id };
  }
}

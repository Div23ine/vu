import { UnrecoverableError } from 'bullmq';
import type { NotifyJobPayload } from '@vunvault/contracts';
import { isProviderError } from '@vunvault/lib/providers';
import type { EmailMessage, SmsMessage } from '@vunvault/lib/providers';
import { renderEmail } from './templates.js';
import type { Logger, NotifyRepo, ReceiptInput } from '../ports.js';

/**
 * Notify-queue handling (Task 90).
 *
 * One payload, four channels, one rule set:
 *
 *  - EVERY attempt writes exactly one receipt row — sent, failed or skipped —
 *    before the handler returns or throws. "The client says they never got it"
 *    is answered from `notification_receipts`, not from memory.
 *  - PERMANENT failures (an invalid number, a rejected address) throw
 *    BullMQ's `UnrecoverableError`: retrying a malformed destination three
 *    more times only burns provider quota.
 *  - TRANSIENT failures (provider down, 5xx) rethrow as-is, and BullMQ's
 *    three-attempt exponential backoff owns the retry. Each attempt receipts
 *    itself, so a mail that failed twice and landed on the third attempt has
 *    three rows telling exactly that story.
 *  - `in_app` writes the inbox row (title ≤ 140, body ≤ 600 — the schema's
 *    checks, enforced here so a long producer string truncates instead of
 *    failing the insert). Duplicates on a retry are tolerated: two identical
 *    tiles are cosmetic, a lost security notification is not.
 *  - `push` never reaches this worker: the dispatcher records push opt-ins and
 *    logs them (Part 2 rule — no push provider exists), and the queue contract
 *    has no push member. The receipts table still allows `skipped` so the
 *    channel can grow a real path later without a migration.
 *  - A receipt write that fails is logged and swallowed when the delivery
 *    itself SUCCEEDED (the mail is out; erroring now would resend it), and
 *    rethrown-with-cause when it did not.
 */

export const INBOX_TITLE_MAX = 140;
export const INBOX_BODY_MAX = 600;
export const RECEIPT_ERROR_MAX = 300;

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<{ id: string }>;
}

export interface NotifyHandlerDeps {
  repo: NotifyRepo;
  email: EmailSender;
  sms: SmsSender;
  logger: Logger;
}

export function truncateInbox(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function clipError(error: unknown): string {
  // A provider error carries a machine-readable code — the receipt is where an
  // operator looks first, so the code leads and the message explains it.
  const message = isProviderError(error)
    ? `${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);
  return message.length > RECEIPT_ERROR_MAX
    ? `${message.slice(0, RECEIPT_ERROR_MAX - 1)}…`
    : message;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain-text-first mail: Resend wants an html part, so the text gets a <pre>. */
export function htmlFromText(text: string): string {
  return `<pre style="font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap;">${escapeHtml(text)}</pre>`;
}

export class NotifyHandler {
  private readonly deps: NotifyHandlerDeps;

  constructor(deps: NotifyHandlerDeps) {
    this.deps = deps;
  }

  async handle(payload: NotifyJobPayload): Promise<void> {
    switch (payload.channel) {
      case 'email':
        return this.handleEmail(payload);
      case 'sms':
        return this.handleSms(payload);
      case 'in_app':
        return this.handleInApp(payload);
    }
  }

  private async receipt(input: ReceiptInput, deliverySucceeded: boolean): Promise<void> {
    try {
      await this.deps.repo.insertReceipt(input);
    } catch (error) {
      // A lost receipt must not cause a resend of a delivered notification.
      this.deps.logger.warn('receipt write failed', {
        channel: input.channel,
        status: input.status,
        message: clipError(error),
      });
      if (!deliverySucceeded) throw error;
    }
  }

  private async handleEmail(
    payload: Extract<NotifyJobPayload, { channel: 'email' }>,
  ): Promise<void> {
    const { to, template, vars } = payload;
    const rendered = renderEmail(template, vars);
    if (!rendered.known) {
      this.deps.logger.warn('unknown_template', { template });
    }
    try {
      const result = await this.deps.email.send({
        to,
        subject: rendered.subject,
        html: htmlFromText(rendered.text),
        text: rendered.text,
      });
      await this.receipt(
        {
          channel: 'email',
          destination: to,
          template,
          status: 'sent',
          providerMessageId: result.id,
        },
        true,
      );
    } catch (error) {
      await this.receipt(
        { channel: 'email', destination: to, template, status: 'failed', error: clipError(error) },
        false,
      );
      if (isProviderError(error) && !error.retryable) {
        throw new UnrecoverableError(`permanent_email_failure: ${error.code}`);
      }
      throw error;
    }
  }

  private async handleSms(payload: Extract<NotifyJobPayload, { channel: 'sms' }>): Promise<void> {
    const { to, body } = payload;
    try {
      const result = await this.deps.sms.send({ to, body });
      await this.receipt(
        {
          channel: 'sms',
          destination: to,
          template: null,
          status: 'sent',
          providerMessageId: result.id,
        },
        true,
      );
    } catch (error) {
      await this.receipt(
        {
          channel: 'sms',
          destination: to,
          template: null,
          status: 'failed',
          error: clipError(error),
        },
        false,
      );
      if (isProviderError(error) && !error.retryable) {
        throw new UnrecoverableError(`permanent_sms_failure: ${error.code}`);
      }
      throw error;
    }
  }

  private async handleInApp(
    payload: Extract<NotifyJobPayload, { channel: 'in_app' }>,
  ): Promise<void> {
    const title = truncateInbox(payload.title, INBOX_TITLE_MAX);
    const body = truncateInbox(payload.body, INBOX_BODY_MAX);
    await this.deps.repo.insertInbox({
      userId: payload.userId,
      event: payload.event,
      title,
      body,
    });
    await this.receipt(
      { channel: 'in_app', destination: payload.userId, template: null, status: 'sent' },
      true,
    );
  }
}

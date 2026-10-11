import { describe, expect, it, vi } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import type { NotifyJobPayload } from '@vunvault/contracts';
import { ProviderError } from '@vunvault/lib/providers';
import {
  htmlFromText,
  INBOX_BODY_MAX,
  INBOX_TITLE_MAX,
  NotifyHandler,
  truncateInbox,
} from './notify-handler';
import type { InboxInput, Logger, NotifyRepo, ReceiptInput } from '../ports';

const USER_ID = 'aaaaaaaa-0000-4000-8000-0000000000a1';

function makeRepo(options: { receiptFails?: boolean } = {}) {
  const inbox: InboxInput[] = [];
  const receipts: ReceiptInput[] = [];
  const repo: NotifyRepo = {
    async insertInbox(input: InboxInput) {
      inbox.push(input);
    },
    async insertReceipt(input: ReceiptInput) {
      if (options.receiptFails === true) throw new Error('db down');
      receipts.push(input);
    },
    getInvoice: vi.fn(),
    setInvoicePdfKey: vi.fn(),
    getReport: vi.fn(),
    setReportObjectKey: vi.fn(),
  } as unknown as NotifyRepo;
  return { repo, inbox, receipts };
}

function makeLogger() {
  const lines: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];
  const logger: Logger = {
    info: (message, fields) => lines.push({ level: 'info', message, fields }),
    warn: (message, fields) => lines.push({ level: 'warn', message, fields }),
    error: (message, fields) => lines.push({ level: 'error', message, fields }),
    debug: (message, fields) => lines.push({ level: 'debug', message, fields }),
  };
  return { logger, lines };
}

const EMAIL_JOB: NotifyJobPayload = {
  channel: 'email',
  to: 'client@horizonsacco.co.ke',
  template: 'scan_completed',
  vars: { title: 'Scan completed', body: 'JOB-4471 is awaiting release.' },
};

const SMS_JOB: NotifyJobPayload = {
  channel: 'sms',
  to: '+254700000001',
  body: 'VUNVAULT: test message',
};

const IN_APP_JOB: NotifyJobPayload = {
  channel: 'in_app',
  userId: USER_ID,
  event: 'scan_completed',
  title: 'Scan completed',
  body: 'JOB-4471 is awaiting release.',
};

describe('NotifyHandler — email', () => {
  it('sends through the provider and writes one sent receipt', async () => {
    const { repo, receipts } = makeRepo();
    const sent: Array<{ to: string; subject: string; html: string; text?: string }> = [];
    const handler = new NotifyHandler({
      repo,
      email: {
        async send(message) {
          sent.push(message);
          return { id: 'em_123' };
        },
      },
      sms: { send: vi.fn() },
      logger: makeLogger().logger,
    });

    await handler.handle(EMAIL_JOB);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe('[VUNVAULT] Scan completed');
    expect(sent[0]?.text).toContain('JOB-4471 is awaiting release.');
    expect(sent[0]?.html).toContain('<pre');
    expect(receipts).toEqual([
      {
        channel: 'email',
        destination: 'client@horizonsacco.co.ke',
        template: 'scan_completed',
        status: 'sent',
        providerMessageId: 'em_123',
      },
    ]);
  });

  it('rethrows a transient provider failure after writing a failed receipt', async () => {
    const { repo, receipts } = makeRepo();
    const handler = new NotifyHandler({
      repo,
      email: {
        async send() {
          throw new ProviderError('email_unavailable', 'Resend did not respond in time', {
            retryable: true,
          });
        },
      },
      sms: { send: vi.fn() },
      logger: makeLogger().logger,
    });

    await expect(handler.handle(EMAIL_JOB)).rejects.toThrow('Resend did not respond');
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.status).toBe('failed');
    expect(receipts[0]?.error).toContain('email_unavailable');
  });

  it('turns a permanent provider failure into an UnrecoverableError (no retry)', async () => {
    const { repo, receipts } = makeRepo();
    const handler = new NotifyHandler({
      repo,
      email: {
        async send() {
          throw new ProviderError('email_invalid_recipient', 'mailbox does not exist');
        },
      },
      sms: { send: vi.fn() },
      logger: makeLogger().logger,
    });

    await expect(handler.handle(EMAIL_JOB)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(receipts[0]?.status).toBe('failed');
  });

  it('logs unknown_template but still delivers', async () => {
    const { repo } = makeRepo();
    const { logger, lines } = makeLogger();
    const sent: string[] = [];
    const handler = new NotifyHandler({
      repo,
      email: {
        async send(message) {
          sent.push(message.subject);
          return { id: 'em_1' };
        },
      },
      sms: { send: vi.fn() },
      logger,
    });

    await handler.handle({ ...EMAIL_JOB, template: 'not_in_registry' });
    expect(sent[0]).toBe('[VUNVAULT] Notification (not_in_registry)');
    expect(lines.some((line) => line.message === 'unknown_template')).toBe(true);
  });

  it('swallows a receipt failure when the mail itself went out', async () => {
    const { repo } = makeRepo({ receiptFails: true });
    const { logger, lines } = makeLogger();
    const handler = new NotifyHandler({
      repo,
      email: {
        async send() {
          return { id: 'em_1' };
        },
      },
      sms: { send: vi.fn() },
      logger,
    });

    await expect(handler.handle(EMAIL_JOB)).resolves.toBeUndefined();
    expect(lines.some((line) => line.message === 'receipt write failed')).toBe(true);
  });
});

describe('NotifyHandler — sms', () => {
  it('sends and receipts', async () => {
    const { repo, receipts } = makeRepo();
    const sent: Array<{ to: string; body: string }> = [];
    const handler = new NotifyHandler({
      repo,
      email: { send: vi.fn() },
      sms: {
        async send(message) {
          sent.push(message);
          return { id: 'at_1' };
        },
      },
      logger: makeLogger().logger,
    });

    await handler.handle(SMS_JOB);
    expect(sent).toEqual([{ to: '+254700000001', body: 'VUNVAULT: test message' }]);
    expect(receipts[0]).toMatchObject({ channel: 'sms', status: 'sent', providerMessageId: 'at_1' });
  });

  it('treats an invalid number as permanent', async () => {
    const { repo, receipts } = makeRepo();
    const handler = new NotifyHandler({
      repo,
      email: { send: vi.fn() },
      sms: {
        async send() {
          throw new ProviderError('sms_invalid_number', 'Not an E.164 number: 0700');
        },
      },
      logger: makeLogger().logger,
    });

    await expect(handler.handle(SMS_JOB)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(receipts[0]?.status).toBe('failed');
  });
});

describe('NotifyHandler — in_app', () => {
  it('writes the inbox row and a sent receipt', async () => {
    const { repo, inbox, receipts } = makeRepo();
    const handler = new NotifyHandler({
      repo,
      email: { send: vi.fn() },
      sms: { send: vi.fn() },
      logger: makeLogger().logger,
    });

    await handler.handle(IN_APP_JOB);
    expect(inbox).toEqual([
      {
        userId: USER_ID,
        event: 'scan_completed',
        title: 'Scan completed',
        body: 'JOB-4471 is awaiting release.',
      },
    ]);
    expect(receipts[0]).toMatchObject({ channel: 'in_app', destination: USER_ID, status: 'sent' });
  });

  it('truncates title and body at the schema limits', () => {
    expect(truncateInbox('x'.repeat(INBOX_TITLE_MAX + 50), INBOX_TITLE_MAX)).toHaveLength(
      INBOX_TITLE_MAX,
    );
    const body = truncateInbox('y'.repeat(INBOX_BODY_MAX + 50), INBOX_BODY_MAX);
    expect(body).toHaveLength(INBOX_BODY_MAX);
    expect(body.endsWith('…')).toBe(true);
  });

  it('truncates in the handler before the insert', async () => {
    const { repo, inbox } = makeRepo();
    const handler = new NotifyHandler({
      repo,
      email: { send: vi.fn() },
      sms: { send: vi.fn() },
      logger: makeLogger().logger,
    });

    await handler.handle({
      ...IN_APP_JOB,
      title: 't'.repeat(200),
      body: 'b'.repeat(900),
    });
    expect(inbox[0]?.title).toHaveLength(INBOX_TITLE_MAX);
    expect(inbox[0]?.body).toHaveLength(INBOX_BODY_MAX);
  });

  it('propagates a DB failure so the queue retries', async () => {
    const repo = {
      insertInbox: vi.fn(async () => {
        throw new Error('db down');
      }),
      insertReceipt: vi.fn(),
    } as unknown as NotifyRepo;
    const handler = new NotifyHandler({
      repo,
      email: { send: vi.fn() },
      sms: { send: vi.fn() },
      logger: makeLogger().logger,
    });

    await expect(handler.handle(IN_APP_JOB)).rejects.toThrow('db down');
  });
});

describe('htmlFromText', () => {
  it('escapes markup so a notification body cannot inject HTML', () => {
    const html = htmlFromText('<script>alert(1)</script> & "quotes"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });
});

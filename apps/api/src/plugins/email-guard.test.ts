import { describe, expect, it, vi } from 'vitest';
import {
  assertPlausibleFromAddress,
  DEFAULT_FROM,
  fetchResendDomainStatus,
  fromDomain,
  ResendEmailProvider,
  RESEND_DOMAINS_URL,
  RESEND_URL,
  type EmailLogger,
} from '../providers/email.js';
import { isProviderError, type ProviderError } from '../providers/error.js';
import { buildResendEmailProvider } from './providers.js';
import type { FastifyBaseLogger } from 'fastify';
import type { SecretName, SecretProvider } from '../lib/secrets/provider.js';

/**
 * Revision 2 addendum, A2 — the Resend delivery contract.
 *
 * The reported bug was "the UI confirms email sent, nothing arrives, and the
 * Resend dashboard shows no send event". These tests pin the three properties
 * that make that failure impossible to repeat silently:
 *
 *   1. no send resolves without a Resend id (A2.2) — a 2xx with no id is a
 *      FAILURE, not a success;
 *   2. every outcome is logged with `{ id, status, error }` + the request id, and
 *      the recipient address never reaches the log;
 *   3. a missing key or an unverified from-domain fails the BOOT (A2.3), so the
 *      process can never start in a state where it answers "check your email"
 *      for mail it is incapable of sending.
 */

function stubFetch(status: number, body: unknown, options: { reject?: boolean } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (options.reject === true) throw new Error('network unreachable');
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  });
  return { calls, impl: impl as unknown as typeof fetch };
}

/** A logger that records everything, so the log contract is assertable. */
function recordingLogger() {
  const lines: Array<{ level: string; fields: Record<string, unknown>; message: string }> = [];
  const log: EmailLogger = {
    info: (fields, message) => lines.push({ level: 'info', fields, message }),
    warn: (fields, message) => lines.push({ level: 'warn', fields, message }),
    error: (fields, message) => lines.push({ level: 'error', fields, message }),
  };
  return { lines, log };
}

/** A full pino-shaped logger, for the calls that go through `buildResendEmailProvider`. */
function recordingFastifyLogger() {
  const lines: Array<{ level: string; message: string }> = [];
  const record =
    (level: string) =>
    (fields: unknown, message?: unknown): void => {
      const text = typeof fields === 'string' ? fields : String(message ?? '');
      lines.push({ level, message: text });
    };
  const logger: Record<string, unknown> = {
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    fatal: record('fatal'),
    debug: record('debug'),
    trace: record('trace'),
    silent: record('silent'),
  };
  logger.child = () => logger;
  return { lines, logger: logger as unknown as FastifyBaseLogger };
}

function secretsWith(values: Partial<Record<SecretName, string>>): SecretProvider {
  return {
    async get(name: SecretName): Promise<string> {
      const value = values[name];
      if (value === undefined) throw new Error(`secret ${name} missing`);
      return value;
    },
  };
}

const MESSAGE = { to: 'someone@example.test', subject: 'Your sign-in link', html: '<p>hi</p>' };

describe('the sender address (A2.3)', () => {
  it('reads the domain out of a display-name from header', () => {
    expect(fromDomain('VUNVAULT <no-reply@vunvault.com>')).toBe('vunvault.com');
    expect(fromDomain('no-reply@vunvault.com')).toBe('vunvault.com');
    expect(fromDomain('not-an-address')).toBeNull();
  });

  it('accepts the configured production sender', () => {
    expect(() => assertPlausibleFromAddress(DEFAULT_FROM)).not.toThrow();
  });

  it('rejects a placeholder or unqualified domain before it can silently fail', () => {
    expect(() => assertPlausibleFromAddress('VUNVAULT <no-reply@localhost>')).toThrow(
      /not a deliverable domain/,
    );
    expect(() => assertPlausibleFromAddress('VUNVAULT <no-reply@localhost.local>')).toThrow();
    expect(() => assertPlausibleFromAddress('VUNVAULT <no-reply@example.com>')).toThrow();
    expect(() => assertPlausibleFromAddress('VUNVAULT')).toThrow(/has no domain/);
  });

  it('asks Resend whether the domain is verified, and says "unknown" when it cannot', async () => {
    const verified = stubFetch(200, { data: [{ name: 'vunvault.com', status: 'verified' }] });
    await expect(fetchResendDomainStatus('re_key', 'vunvault.com', verified.impl)).resolves.toBe(
      'verified',
    );
    expect(verified.calls[0]?.url).toBe(RESEND_DOMAINS_URL);

    const pending = stubFetch(200, { data: [{ name: 'vunvault.com', status: 'pending' }] });
    await expect(fetchResendDomainStatus('re_key', 'vunvault.com', pending.impl)).resolves.toBe(
      'pending',
    );

    // Unreachable control plane is `null` — explicitly NOT "unverified".
    const down = stubFetch(200, {}, { reject: true });
    await expect(fetchResendDomainStatus('re_key', 'vunvault.com', down.impl)).resolves.toBeNull();
    const denied = stubFetch(401, { message: 'nope' });
    await expect(fetchResendDomainStatus('re_key', 'vunvault.com', denied.impl)).resolves.toBeNull();
  });
});

describe('the send contract (A2.2)', () => {
  it('awaits the response and logs { id, status, error } plus the request id', async () => {
    const { calls, impl } = stubFetch(200, { id: 'email-01HZX' });
    const { lines, log } = recordingLogger();

    const result = await new ResendEmailProvider('re_key', impl, log).send(MESSAGE, {
      requestId: 'req-123',
      purpose: 'magic_link',
    });

    expect(result).toEqual({ id: 'email-01HZX' });
    expect(calls[0]?.url).toBe(RESEND_URL);

    const line = lines.at(-1);
    expect(line?.level).toBe('info');
    expect(line?.fields).toMatchObject({
      provider: 'resend',
      id: 'email-01HZX',
      status: 200,
      error: null,
      requestId: 'req-123',
      purpose: 'magic_link',
    });
    // The recipient must never reach the log — it is PII and an enumeration leak.
    expect(JSON.stringify(line?.fields)).not.toContain('someone@example.test');
  });

  it('treats a 2xx with no id as a FAILURE, not a silent success', async () => {
    const { impl } = stubFetch(200, {});
    const { lines, log } = recordingLogger();

    const error = await new ResendEmailProvider('re_key', impl, log)
      .send(MESSAGE, { requestId: 'req-1' })
      .catch((cause: unknown) => cause);

    expect(isProviderError(error)).toBe(true);
    expect((error as ProviderError).code).toBe('email_rejected');
    expect(lines.at(-1)?.level).toBe('error');
    expect(lines.at(-1)?.fields.id).toBeNull();
  });

  it('logs and throws on a rejection, without leaking provider detail to the caller', async () => {
    const { impl } = stubFetch(422, { message: 'Recipient address is invalid' });
    const { lines, log } = recordingLogger();

    const error = await new ResendEmailProvider('re_key', impl, log)
      .send(MESSAGE, { requestId: 'req-2', purpose: 'signup_invite' })
      .catch((cause: unknown) => cause);

    expect((error as ProviderError).code).toBe('email_rejected');
    expect((error as ProviderError).retryable).toBe(false);
    expect(lines.at(-1)).toMatchObject({
      level: 'error',
      fields: { status: 422, id: null, error: 'Recipient address is invalid' },
    });
  });

  it('logs and classifies an unreachable provider as retryable', async () => {
    const { impl } = stubFetch(200, {}, { reject: true });
    const { lines, log } = recordingLogger();

    const error = await new ResendEmailProvider('re_key', impl, log)
      .send(MESSAGE, { requestId: 'req-3' })
      .catch((cause: unknown) => cause);

    expect((error as ProviderError).code).toBe('email_unavailable');
    expect((error as ProviderError).retryable).toBe(true);
    expect(lines.at(-1)?.level).toBe('error');
    expect(lines.at(-1)?.message).toMatch(/NOT delivered/);
  });

  it('classifies a 5xx as retryable and says so in the log', async () => {
    const { impl } = stubFetch(503, { message: 'upstream' });
    const { lines, log } = recordingLogger();

    const error = await new ResendEmailProvider('re_key', impl, log)
      .send(MESSAGE)
      .catch((cause: unknown) => cause);

    expect((error as ProviderError).code).toBe('email_unavailable');
    expect((error as ProviderError).retryable).toBe(true);
    expect(lines.at(-1)?.fields.status).toBe(503);
  });
});

describe('the startup guard (A2.3)', () => {
  it('refuses to boot when RESEND_API_KEY is missing, and says why', async () => {
    const { lines, log } = recordingLogger();
    const fatals: string[] = [];
    const logger = {
      ...log,
      fatal: (fields: Record<string, unknown>, message: string) => {
        fatals.push(message);
        lines.push({ level: 'fatal', fields, message });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await expect(
      buildResendEmailProvider(logger, secretsWith({}), stubFetch(200, { data: [] }).impl),
    ).rejects.toThrow(/FATAL: RESEND_API_KEY is not set/);
    expect(fatals.join('\n')).toMatch(/Refusing to boot/);
  });

  it('refuses to boot when the from-domain is definitively not verified', async () => {
    const { impl } = stubFetch(200, { data: [{ name: 'vunvault.com', status: 'pending' }] });
    const logger = { fatal: () => undefined, info: () => undefined } as never;

    await expect(
      buildResendEmailProvider(logger, secretsWith({ RESEND_API_KEY: 're_key' }), impl),
    ).rejects.toThrow(/is "pending" in Resend, not "verified"/);
  });

  it('boots when the domain is verified', async () => {
    const { impl } = stubFetch(200, { data: [{ name: 'vunvault.com', status: 'verified' }] });
    const { lines, logger } = recordingFastifyLogger();

    const provider = await buildResendEmailProvider(
      logger,
      secretsWith({ RESEND_API_KEY: 're_key' }),
      impl,
    );
    expect(provider).toBeInstanceOf(ResendEmailProvider);
    // The happy path says so, at info, with the domain it confirmed.
    expect(lines.some((line) => line.level === 'info')).toBe(true);
    expect(lines.some((line) => line.level === 'fatal')).toBe(false);
  });

  it('logs FATAL but still boots when Resend cannot be consulted at all', async () => {
    // A control-plane blip must not take the platform down; the risk is logged
    // loudly instead, and a real rejection still surfaces per message.
    const { impl } = stubFetch(500, {});
    const messages: string[] = [];
    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      fatal: (_fields: unknown, message: string) => messages.push(message),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const provider = await buildResendEmailProvider(
      logger,
      secretsWith({ RESEND_API_KEY: 're_key' }),
      impl,
    );
    expect(provider).toBeInstanceOf(ResendEmailProvider);
    expect(messages.join('\n')).toMatch(/could not confirm that the from-domain is verified/);
  });
});

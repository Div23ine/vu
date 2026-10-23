import { describe, expect, it, vi } from 'vitest';
import {
  AfricasTalkingSmsProvider,
  AFRICA_CALLING_CODES,
  isAfricanNumber,
  SmsRouter,
  TwilioSmsProvider,
} from './sms';
import { DEFAULT_FROM, ResendEmailProvider, RESEND_URL } from './email';
import { isProviderError, ProviderError } from './error';

interface RecordedCall {
  url: string;
  init: RequestInit;
}

/** A fetch double that records every call and returns a canned response. */
function stubFetch(status: number, body: unknown, options: { reject?: boolean } = {}) {
  const calls: RecordedCall[] = [];
  const impl = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    if (options.reject === true) throw new Error('network down');
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe('ResendEmailProvider', () => {
  const message = {
    to: 'jane.wanjiru@acmefintech.co.ke',
    subject: 'Invitation to join VUNVAULT',
    html: '<p>Accept your invitation.</p>',
    text: 'Accept your invitation.',
  };

  it('posts the documented payload and maps the id', async () => {
    const { calls, impl } = stubFetch(200, { id: 'email-01HZX' });
    const provider = new ResendEmailProvider('re_test_key', impl);

    await expect(provider.send(message)).resolves.toEqual({ id: 'email-01HZX' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(RESEND_URL);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_key');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      from: DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    expect(DEFAULT_FROM).toBe('VUNVAULT <no-reply@vunvault.com>');
  });

  it('honours an explicit sender and sends an abort timeout', async () => {
    const { calls, impl } = stubFetch(200, { id: 'email-2' });
    await new ResendEmailProvider('re_test_key', impl).send({
      ...message,
      from: 'VUNVAULT Intel <intel@vunvault.com>',
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      from: 'VUNVAULT Intel <intel@vunvault.com>',
    });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('classifies a 4xx as a non-retryable rejection', async () => {
    const { impl } = stubFetch(422, { message: 'Recipient address is invalid' });
    const error = await new ResendEmailProvider('re_test_key', impl)
      .send(message)
      .catch((caught: unknown) => caught);
    expect(isProviderError(error)).toBe(true);
    expect((error as ProviderError).code).toBe('email_rejected');
    expect((error as ProviderError).retryable).toBe(false);
    expect((error as ProviderError).message).toBe('Recipient address is invalid');
  });

  it('classifies a 5xx as retryable', async () => {
    const { impl } = stubFetch(503, { message: 'upstream' });
    const error = await new ResendEmailProvider('re_test_key', impl)
      .send(message)
      .catch((caught: unknown) => caught);
    expect((error as ProviderError).code).toBe('email_unavailable');
    expect((error as ProviderError).retryable).toBe(true);
  });

  it('classifies a network failure or timeout as retryable', async () => {
    const { impl } = stubFetch(200, {}, { reject: true });
    const error = await new ResendEmailProvider('re_test_key', impl)
      .send(message)
      .catch((caught: unknown) => caught);
    expect((error as ProviderError).code).toBe('email_unavailable');
    expect((error as ProviderError).retryable).toBe(true);
  });
});

describe('AfricasTalkingSmsProvider', () => {
  const message = { to: '+254712345678', body: 'SEV-1 advisory issued for CVE-2026-21447.' };

  it('posts form-encoded credentials and maps the message id', async () => {
    const { calls, impl } = stubFetch(200, {
      SMSMessageData: { Recipients: [{ messageId: 'ATXid1', status: 'Success' }] },
    });
    const provider = new AfricasTalkingSmsProvider('vunvault', 'at_key', impl);

    await expect(provider.send(message)).resolves.toEqual({ id: 'ATXid1' });
    expect(calls[0]?.url).toBe('https://api.africastalking.com/version1/messaging');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.apiKey).toBe('at_key');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(calls[0]?.init.body).toBeInstanceOf(URLSearchParams);
    const form = calls[0]?.init.body as URLSearchParams;
    expect(form.get('username')).toBe('vunvault');
    expect(form.get('to')).toBe(message.to);
    expect(form.get('message')).toBe(message.body);
  });

  it('classifies 4xx and 5xx differently', async () => {
    const rejected = stubFetch(401, { message: 'Invalid API key' });
    const error4xx = await new AfricasTalkingSmsProvider('vunvault', 'bad', rejected.impl)
      .send(message)
      .catch((caught: unknown) => caught);
    expect((error4xx as ProviderError).code).toBe('sms_rejected');
    expect((error4xx as ProviderError).retryable).toBe(false);

    const unavailable = stubFetch(500, {});
    const error5xx = await new AfricasTalkingSmsProvider('vunvault', 'at_key', unavailable.impl)
      .send(message)
      .catch((caught: unknown) => caught);
    expect((error5xx as ProviderError).code).toBe('sms_unavailable');
    expect((error5xx as ProviderError).retryable).toBe(true);
  });
});

describe('TwilioSmsProvider', () => {
  const message = { to: '+447700900123', body: 'Your VUNVAULT code is 481920.' };

  it('posts Basic auth and the Messages.json form', async () => {
    const { calls, impl } = stubFetch(201, { sid: 'SM123' });
    const provider = new TwilioSmsProvider('AC123', 'token', '+15551234567', impl);

    await expect(provider.send(message)).resolves.toEqual({ id: 'SM123' });
    expect(calls[0]?.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('AC123:token').toString('base64')}`);
    const form = calls[0]?.init.body as URLSearchParams;
    expect(form.get('To')).toBe(message.to);
    expect(form.get('From')).toBe('+15551234567');
    expect(form.get('Body')).toBe(message.body);
  });

  it('classifies a 4xx as rejected and a 5xx as retryable', async () => {
    const rejected = stubFetch(400, { message: 'To number is not mobile' });
    const error4xx = await new TwilioSmsProvider('AC1', 't', '+15551234567', rejected.impl)
      .send(message)
      .catch((caught: unknown) => caught);
    expect((error4xx as ProviderError).code).toBe('sms_rejected');

    const unavailable = stubFetch(502, {});
    const error5xx = await new TwilioSmsProvider('AC1', 't', '+15551234567', unavailable.impl)
      .send(message)
      .catch((caught: unknown) => caught);
    expect((error5xx as ProviderError).code).toBe('sms_unavailable');
    expect((error5xx as ProviderError).retryable).toBe(true);
  });
});

describe('SmsRouter', () => {
  function router() {
    const africa = { send: vi.fn(async () => ({ id: 'AT' })), name: 'africa' };
    const rest = { send: vi.fn(async () => ({ id: 'TW' })), name: 'rest' };
    return { router: new SmsRouter(africa, rest), africa, rest };
  }

  it('routes every African calling code to Africa’s Talking', () => {
    expect(isAfricanNumber('+254712345678')).toBe(true);
    for (const code of AFRICA_CALLING_CODES) {
      expect(isAfricanNumber(`${code}712345678`), code).toBe(true);
    }
  });

  it('routes every other number to Twilio', () => {
    expect(isAfricanNumber('+447700900123')).toBe(false);
    expect(isAfricanNumber('+15551234567')).toBe(false);
    expect(isAfricanNumber('+919876543210')).toBe(false);
  });

  it('sends through the chosen provider', async () => {
    const { router: smsRouter, africa, rest } = router();
    await expect(smsRouter.send({ to: '+254712345678', body: 'test' })).resolves.toEqual({
      id: 'AT',
    });
    expect(africa.send).toHaveBeenCalledTimes(1);
    expect(rest.send).not.toHaveBeenCalled();

    await expect(smsRouter.send({ to: '+447700900123', body: 'test' })).resolves.toEqual({
      id: 'TW',
    });
    expect(rest.send).toHaveBeenCalledTimes(1);
  });

  it('never calls a provider for an invalid number', async () => {
    const { router: smsRouter, africa, rest } = router();
    for (const invalid of ['0712345678', '+254', 'not-a-number', '', '+0171234567']) {
      const error = await smsRouter
        .send({ to: invalid, body: 'test' })
        .catch((caught: unknown) => caught);
      expect(isProviderError(error), invalid).toBe(true);
      expect((error as ProviderError).code, invalid).toBe('sms_invalid_number');
    }
    expect(africa.send).not.toHaveBeenCalled();
    expect(rest.send).not.toHaveBeenCalled();
  });

  it('exposes the routing decision for diagnostics', () => {
    const { router: smsRouter } = router();
    expect(smsRouter.providerFor('+254712345678')).toBe('africas_talking');
    expect(smsRouter.providerFor('+447700900123')).toBe('twilio');
    expect(() => smsRouter.providerFor('nope')).toThrow(ProviderError);
  });
});

describe('ProviderError', () => {
  it('carries a code and a retryable flag, defaulting to non-retryable', () => {
    const rejected = new ProviderError('email_rejected');
    expect(rejected.code).toBe('email_rejected');
    expect(rejected.message).toBe('email_rejected');
    expect(rejected.retryable).toBe(false);
    expect(isProviderError(rejected)).toBe(true);
    expect(isProviderError(new Error('x'))).toBe(false);
    const retryable = new ProviderError('email_unavailable', 'timed out', { retryable: true });
    expect(retryable.retryable).toBe(true);
    expect(retryable.message).toBe('timed out');
  });
});

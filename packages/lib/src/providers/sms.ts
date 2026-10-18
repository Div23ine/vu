/**
 * SMS providers and the router that picks between them.
 *
 * Africa's Talking carries African numbers (better deliverability and local sender
 * ids); Twilio carries everything else. Both are plain `fetch` calls with an
 * 8-second timeout and no internal retry — BullMQ owns retries.
 */
import { ProviderError } from './error.js';

export const PROVIDER_TIMEOUT_MS = 8000;
export const AFRICAS_TALKING_URL = 'https://api.africastalking.com/version1/messaging';

/** E.164, digits only after the `+`. */
export const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/** Country calling codes served by Africa's Talking. */
export const AFRICA_CALLING_CODES = [
  '+254', // Kenya
  '+255', // Tanzania
  '+256', // Uganda
  '+250', // Rwanda
  '+234', // Nigeria
  '+233', // Ghana
  '+27', // South Africa
  '+20', // Egypt
  '+251', // Ethiopia
] as const;

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<{ id: string }>;
}

/** Reject anything that is not a plausible E.164 number before spending a request. */
export function assertValidNumber(to: string): void {
  if (!E164_PATTERN.test(to)) {
    throw new ProviderError('sms_invalid_number', `Not an E.164 number: ${to}`);
  }
}

/** True when the number belongs to a market Africa's Talking serves. */
export function isAfricanNumber(to: string): boolean {
  // Longest prefix first so `+254` wins over a shorter overlapping code.
  const codes = [...AFRICA_CALLING_CODES].sort((a, b) => b.length - a.length);
  return codes.some((code) => to.startsWith(code) && to.length > code.length);
}

interface AfricasTalkingResponse {
  SMSMessageData?: { Recipients?: Array<{ messageId?: string; status?: string }> };
  message?: string;
}

export class AfricasTalkingSmsProvider implements SmsProvider {
  private readonly username: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(username: string, apiKey: string, fetchImpl: typeof fetch = fetch) {
    this.username = username;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async send(message: SmsMessage): Promise<{ id: string }> {
    assertValidNumber(message.to);

    let response: Response;
    try {
      response = await this.fetchImpl(AFRICAS_TALKING_URL, {
        method: 'POST',
        headers: {
          apiKey: this.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: this.username,
          to: message.to,
          message: message.body,
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      throw new ProviderError('sms_unavailable', "Africa's Talking did not respond in time", {
        retryable: true,
      });
    }

    const payload = (await response.json().catch(() => ({}))) as AfricasTalkingResponse;

    if (response.status >= 500) {
      throw new ProviderError('sms_unavailable', "Africa's Talking is unavailable", {
        retryable: true,
      });
    }
    if (!response.ok) {
      throw new ProviderError(
        'sms_rejected',
        payload.message ?? "Africa's Talking rejected the SMS",
      );
    }

    const recipient = payload.SMSMessageData?.Recipients?.[0];
    const id = recipient?.messageId;
    if (id === undefined) {
      throw new ProviderError('sms_rejected', "Africa's Talking returned no message id");
    }
    return { id };
  }
}

export const TWILIO_MESSAGES_PATH = '/2010-04-01/Accounts';

interface TwilioResponse {
  sid?: string;
  message?: string;
}

export class TwilioSmsProvider implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly from: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    accountSid: string,
    authToken: string,
    from: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.from = from;
    this.fetchImpl = fetchImpl;
  }

  async send(message: SmsMessage): Promise<{ id: string }> {
    assertValidNumber(message.to);

    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://api.twilio.com${TWILIO_MESSAGES_PATH}/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: message.to, From: this.from, Body: message.body }),
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        },
      );
    } catch {
      throw new ProviderError('sms_unavailable', 'Twilio did not respond in time', {
        retryable: true,
      });
    }

    const payload = (await response.json().catch(() => ({}))) as TwilioResponse;

    if (response.status >= 500) {
      throw new ProviderError('sms_unavailable', 'Twilio is unavailable', { retryable: true });
    }
    if (!response.ok) {
      throw new ProviderError('sms_rejected', payload.message ?? 'Twilio rejected the SMS');
    }
    if (payload.sid === undefined) {
      throw new ProviderError('sms_rejected', 'Twilio returned no message sid');
    }
    return { id: payload.sid };
  }
}

/**
 * Sends through Africa's Talking for African numbers and Twilio elsewhere. An
 * invalid number is rejected before either provider is called.
 */
export class SmsRouter implements SmsProvider {
  constructor(
    private readonly africa: SmsProvider,
    private readonly rest: SmsProvider,
  ) {}

  /** Which provider a number routes to — exposed so tests can assert the table. */
  providerFor(to: string): 'africas_talking' | 'twilio' {
    assertValidNumber(to);
    return isAfricanNumber(to) ? 'africas_talking' : 'twilio';
  }

  async send(message: SmsMessage): Promise<{ id: string }> {
    const provider = this.providerFor(message.to) === 'africas_talking' ? this.africa : this.rest;
    return provider.send(message);
  }
}

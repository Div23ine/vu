/**
 * Delivery providers (extracted from the API in Task 90).
 *
 * One copy, two consumers: the API sends synchronous mail (OTP, verification)
 * and the notify worker consumes the `notify` queue with the same clients, so
 * provider behaviour can never drift between them.
 *
 * `email.ts` and `sms.ts` each define their own `PROVIDER_TIMEOUT_MS` (the same
 * 8-second budget, but independently reasoned about), so the re-exports below
 * are explicit rather than `export *` — an ambiguous member here would be a
 * compile error for every consumer.
 */

export { ProviderError, isProviderError } from './error';

export {
  DEFAULT_FROM,
  PROVIDER_TIMEOUT_MS as EMAIL_PROVIDER_TIMEOUT_MS,
  RESEND_URL,
  ResendEmailProvider,
  type EmailMessage,
  type EmailProvider,
} from './email';

export {
  AFRICA_CALLING_CODES,
  AFRICAS_TALKING_URL,
  AfricasTalkingSmsProvider,
  assertValidNumber,
  E164_PATTERN,
  isAfricanNumber,
  PROVIDER_TIMEOUT_MS as SMS_PROVIDER_TIMEOUT_MS,
  SmsRouter,
  TWILIO_MESSAGES_PATH,
  TwilioSmsProvider,
  type SmsMessage,
  type SmsProvider,
} from './sms';

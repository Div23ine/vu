import {
  AfricasTalkingSmsProvider,
  ResendEmailProvider,
  SmsRouter,
  TwilioSmsProvider,
} from '@vunvault/lib/providers';
import type { EmailSender, SmsSender } from '../ports';
import type { Env } from '../config/env';

/**
 * Delivery providers built from the validated environment.
 *
 * These are the SAME clients the API uses, from `@vunvault/lib/providers`
 * (extracted in Task 90; Task 89 shipped this app with its own copies). The
 * broadcast worker sends e-mail and SMS directly — not
 * through the `notify` queue — so the row's `sent_email`/`sent_sms` counters
 * report deliveries that actually happened, live, while an operator watches.
 */
export interface DeliveryProviders {
  email: EmailSender;
  sms: SmsSender;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildProviders(env: Env): DeliveryProviders {
  const resend = new ResendEmailProvider(env.RESEND_API_KEY);
  return {
    // The port is text-first (broadcast copy is plain text); Resend wants an
    // html part, so the text is wrapped in a <pre> — escaped, no markup invented.
    email: {
      send: async (message) =>
        resend.send({
          to: message.to,
          subject: message.subject,
          html: `<pre style="font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap;">${escapeHtml(message.text)}</pre>`,
          text: message.text,
        }),
    },
    sms: new SmsRouter(
      new AfricasTalkingSmsProvider(env.AFRICASTALKING_USERNAME, env.AFRICASTALKING_API_KEY),
      new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM),
    ),
  };
}

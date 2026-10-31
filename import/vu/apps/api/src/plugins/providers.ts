import fp from 'fastify-plugin';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import {
  assertPlausibleFromAddress,
  DEFAULT_FROM,
  fetchResendDomainStatus,
  fromDomain,
  ResendEmailProvider,
  type EmailProvider,
} from '../providers/email.js';
import {
  AfricasTalkingSmsProvider,
  SmsRouter,
  TwilioSmsProvider,
  type SmsProvider,
} from '../providers/sms.js';
import type { SecretProvider } from '../lib/secrets/provider.js';
import { R2ObjectStorage, type ObjectStorage } from '../lib/object-storage.js';
import { NotificationDispatcher } from '../lib/notify.js';
import { SqlNotificationPrefsRepo } from '../routes/v1/account-sessions/repo.js';

export interface ProvidersPluginOptions {
  /** Test seam: inject providers instead of building them from secrets. */
  email?: EmailProvider;
  sms?: SmsProvider;
  storage?: ObjectStorage;
  notify?: NotificationDispatcher;
  secrets?: SecretProvider;
}

/**
 * Build the Resend provider, guarding the two misconfigurations that produce the
 * exact failure the Revision 2 addendum (A2) was written about: a send that the
 * UI reports as successful while Resend never sees it.
 *
 * A2.3 — the startup guard:
 *
 *   · `RESEND_API_KEY` unset or empty → **refuse to boot.** A missing key used to
 *     surface as a throw from deep inside a request; now it is a FATAL at startup
 *     with an actionable message. There is no code path that short-circuits to
 *     `{ ok: true }` when the key is absent.
 *   · the configured from-domain is **definitively not verified** in Resend →
 *     **refuse to boot.** Resend accepts a request for an unverified domain and
 *     then refuses DELIVERY, which is indistinguishable from the original bug at
 *     the UI. Failing at boot is the only place it can be caught honestly.
 *   · the from-domain **could not be checked** (Resend's management API
 *     unreachable, or a non-2xx) → a loud FATAL-level log, then continue. Taking
 *     the whole platform down because a control-plane endpoint blipped is a worse
 *     outcome than booting with the risk logged; the send path still surfaces any
 *     real rejection per-message.
 *
 * The provider also receives the logger, so every send writes the full Resend
 * response `{ id, status, error }` and the request id (A2.2).
 */
export async function buildResendEmailProvider(
  log: FastifyBaseLogger,
  secrets: SecretProvider,
  fetchImpl: typeof fetch = fetch,
): Promise<EmailProvider> {
  const apiKey = await secrets.get('RESEND_API_KEY').catch(() => undefined);

  if (apiKey === undefined || apiKey.trim() === '') {
    const message =
      'FATAL: RESEND_API_KEY is not set. Email delivery is impossible, so magic-link sign-in ' +
      'and signup verification cannot work. Refusing to boot rather than answering "check your ' +
      'email" for mail that was never sent. Set the secret (vault in production) and restart.';
    log.fatal({ secret: 'RESEND_API_KEY' }, message);
    throw new Error(message);
  }

  const from = DEFAULT_FROM;
  try {
    assertPlausibleFromAddress(from);
  } catch (error) {
    const message = `FATAL: the configured email sender is not deliverable — ${
      error instanceof Error ? error.message : String(error)
    }. Refusing to boot.`;
    log.fatal({ from }, message);
    throw new Error(message);
  }

  const domain = fromDomain(from);
  if (domain !== null) {
    const status = await fetchResendDomainStatus(apiKey, domain, fetchImpl);
    if (status === null) {
      log.fatal(
        { domain, from },
        'FATAL: could not confirm that the from-domain is verified in Resend (the domains API ' +
          'did not answer). Booting anyway — but if mail is accepted and never delivered, this ' +
          'is the first thing to check. Verify the domain in Resend → Domains.',
      );
    } else if (status !== 'verified') {
      const message =
        `FATAL: the from-domain "${domain}" is "${status}" in Resend, not "verified". Resend ` +
        'accepts the send and then refuses delivery, which looks exactly like a silently lost ' +
        'email. Refusing to boot. Verify the domain in Resend → Domains, then restart.';
      log.fatal({ domain, status }, message);
      throw new Error(message);
    } else {
      log.info({ domain, status }, 'resend from-domain verified');
    }
  }

  return new ResendEmailProvider(apiKey, fetchImpl, log);
}

/**
 * Decorates `app.email` and `app.sms`.
 *
 * Providers are built lazily-safe: the API keys are read once at boot so a missing
 * key fails the deployment instead of the first customer notification. The SMS
 * sender is a router — Africa's Talking for African numbers, Twilio for the rest.
 */
const providersPlugin: FastifyPluginAsync<ProvidersPluginOptions> = async (app, options) => {
  const secrets = options.secrets ?? app.secrets;

  if (options.email !== undefined) {
    app.decorate('email', options.email);
  } else {
    app.decorate('email', await buildResendEmailProvider(app.log, secrets));
  }

  if (options.sms !== undefined) {
    app.decorate('sms', options.sms);
  } else {
    const [username, atKey, accountSid, authToken] = await Promise.all([
      secrets.get('AFRICASTALKING_USERNAME'),
      secrets.get('AFRICASTALKING_API_KEY'),
      secrets.get('TWILIO_ACCOUNT_SID'),
      secrets.get('TWILIO_AUTH_TOKEN'),
    ]);
    app.decorate(
      'sms',
      new SmsRouter(
        new AfricasTalkingSmsProvider(username, atKey),
        // `TWILIO_FROM` is configuration, not a secret.
        new TwilioSmsProvider(accountSid, authToken, process.env.TWILIO_FROM ?? ''),
      ),
    );
  }

  if (options.storage !== undefined) {
    app.decorate('storage', options.storage);
  } else {
    const [accessKeyId, secretAccessKey] = await Promise.all([
      secrets.get('R2_ACCESS_KEY_ID'),
      secrets.get('R2_SECRET_ACCESS_KEY'),
    ]);
    app.decorate(
      'storage',
      new R2ObjectStorage({
        accountId: app.env.R2_ACCOUNT_ID,
        bucket: app.env.R2_BUCKET,
        publicBaseUrl: app.env.R2_PUBLIC_BASE_URL,
        accessKeyId,
        secretAccessKey,
      }),
    );
  }

  if (options.notify !== undefined) {
    app.decorate('notify', options.notify);
  } else {
    // The repo is constructed per call against `app.db`, which only exists once
    // the infrastructure plugin has run — hence the getter, not an instance.
    app.decorate(
      'notify',
      new NotificationDispatcher({
        prefs: {
          recipient: (userId) => new SqlNotificationPrefsRepo(app.db).recipient(userId),
          toggles: (userId, event) =>
            new SqlNotificationPrefsRepo(app.db).listToggles(userId).then(
              (rows) =>
                rows.find((row) => row.event === event) ?? {
                  inApp: true,
                  email: true,
                  sms: false,
                  push: false,
                },
            ),
          quietHours: (userId) => new SqlNotificationPrefsRepo(app.db).getQuietHours(userId),
        },
        enqueue: async (payload) => {
          await app.queues.notify.add(payload.channel, payload);
        },
        debug: (message, fields) => app.log.debug(fields ?? {}, message),
      }),
    );
  }
};

export default fp(providersPlugin, { name: 'providers', dependencies: ['secrets'] });

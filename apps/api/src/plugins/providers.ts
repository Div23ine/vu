import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ResendEmailProvider, type EmailProvider } from '../providers/email.js';
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
    app.decorate('email', new ResendEmailProvider(await secrets.get('RESEND_API_KEY')));
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

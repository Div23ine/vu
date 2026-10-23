import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createSecretProvider, type SecretProvider } from '../lib/secrets/provider';

export interface SecretsPluginOptions {
  /** Test seam: inject a provider instead of deriving one from `app.env`. */
  provider?: SecretProvider;
}

/**
 * Decorates `app.secrets`.
 *
 * `SECRETS_PROVIDER=oci-vault` selects the Vault provider; anything else reads the
 * environment. Registered first, because every other infrastructure plugin asks it
 * for a connection string.
 */
const secretsPlugin: FastifyPluginAsync<SecretsPluginOptions> = async (app, options) => {
  const provider = options.provider ?? createSecretProvider(app.env);
  app.decorate('secrets', provider);
};

export default fp(secretsPlugin, { name: 'secrets' });

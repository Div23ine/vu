/**
 * Secret providers.
 *
 * Two implementations: `EnvSecretProvider` for development and tests, and
 * `OciVaultSecretProvider` for production, where secrets live in OCI Vault and are
 * fetched with the workload's own identity.
 *
 * Rules:
 *  - a secret is never written into `process.env`;
 *  - a secret value is never logged (only its name ever appears in a message);
 *  - Vault reads are cached for five minutes so a request path never blocks on
 *    the Vault API.
 */
import type { Env } from '../../config/env';

/** Every secret the API can ask for. Adding a name here is a deliberate act. */
export const SECRET_NAMES = [
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'UPSTASH_REDIS_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PAYSTACK_SECRET_KEY',
  'RESEND_API_KEY',
  'AFRICASTALKING_API_KEY',
  'AFRICASTALKING_USERNAME',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'AUDIT_HMAC_KEY',
  'AUDIT_AES_KEY',
  'NVD_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'SCAN_CONTROLLER_HMAC_KEY',
  // Task 99: the edge origin lock — the shared header secret between the
  // Cloudflare Worker and the API.
  'EDGE_ORIGIN_SECRET',
] as const;

export type SecretName = (typeof SECRET_NAMES)[number];

export interface SecretProvider {
  get(name: SecretName): Promise<string>;
}

export function missingSecret(name: SecretName): Error {
  return new Error(`secret ${name} missing`);
}

/** Development and test only: read the value straight from the environment. */
export class EnvSecretProvider implements SecretProvider {
  async get(name: SecretName): Promise<string> {
    const value = process.env[name];
    if (value === undefined || value === '') throw missingSecret(name);
    return value;
  }
}

/** The narrow slice of `SecretsClient` this provider needs — also the test seam. */
export interface OciSecretsClientLike {
  getSecretBundle(request: unknown): Promise<unknown>;
}

export interface OciVaultSecretProviderOptions {
  /** JSON object mapping a secret name to its Vault OCID. */
  secretMap: Record<string, string>;
  /** Injected client (tests). Built from the workload identity when omitted. */
  client?: OciSecretsClientLike;
  /** Cache lifetime. Five minutes by default. */
  ttlMs?: number;
  /** Injectable clock, so cache expiry is testable without waiting. */
  now?: () => number;
  /** Injectable auth factory, so tests never touch OCI metadata endpoints. */
  buildClient?: () => Promise<OciSecretsClientLike>;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

interface CacheEntry {
  value: string;
  expiresAt: number;
}

function readContent(response: unknown): string | undefined {
  const bundle = (response as { secretBundle?: { secretBundleContent?: { content?: string } } })
    .secretBundle;
  return bundle?.secretBundleContent?.content;
}

/** Production provider: OCI Vault, resource or instance principal, 5-minute cache. */
export class OciVaultSecretProvider implements SecretProvider {
  private readonly secretMap: Record<string, string>;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<SecretName, CacheEntry>();
  private client?: OciSecretsClientLike;
  private readonly buildClient: () => Promise<OciSecretsClientLike>;

  constructor(options: OciVaultSecretProviderOptions) {
    this.secretMap = options.secretMap;
    this.ttlMs = options.ttlMs ?? FIVE_MINUTES_MS;
    this.now = options.now ?? (() => Date.now());
    this.client = options.client;
    this.buildClient = options.buildClient ?? (() => createOciSecretsClient());
  }

  async get(name: SecretName): Promise<string> {
    const cached = this.cache.get(name);
    if (cached !== undefined && cached.expiresAt > this.now()) return cached.value;

    const ocid = this.secretMap[name];
    if (ocid === undefined || ocid === '') throw missingSecret(name);

    const client = this.client ?? (await this.buildClient());
    this.client = client;

    const response = await client.getSecretBundle({ secretId: ocid, stage: 'CURRENT' });
    const encoded = readContent(response);
    if (encoded === undefined || encoded === '') throw missingSecret(name);

    const value = Buffer.from(encoded, 'base64').toString('utf8');
    this.cache.set(name, { value, expiresAt: this.now() + this.ttlMs });
    return value;
  }
}

/**
 * Build a real `SecretsClient` from the workload identity: resource principal
 * inside a function or container that has one, instance principal otherwise.
 */
export async function createOciSecretsClient(): Promise<OciSecretsClientLike> {
  const common = await import('oci-common');
  const { SecretsClient } = await import('oci-secrets');

  const resourcePrincipal = common.ResourcePrincipalAuthenticationDetailsProvider as unknown as {
    builder?: () => { build(): Promise<unknown> };
  };

  const authentication =
    process.env.OCI_RESOURCE_PRINCIPAL_VERSION !== undefined &&
    typeof resourcePrincipal.builder === 'function'
      ? await resourcePrincipal.builder().build()
      : await new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build();

  return new SecretsClient(
    authentication as ConstructorParameters<typeof SecretsClient>[0],
  ) as unknown as OciSecretsClientLike;
}

/** Parse `OCI_SECRET_MAP`, tolerating an absent value in development. */
export function parseSecretMap(raw: string | undefined): Record<string, string> {
  if (raw === undefined || raw.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `OCI_SECRET_MAP is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('OCI_SECRET_MAP must be a JSON object of name to OCID');
  }
  const map: Record<string, string> = {};
  for (const [name, ocid] of Object.entries(parsed)) {
    if (typeof ocid === 'string') map[name] = ocid;
  }
  return map;
}

/** Pick the provider the configuration asks for. */
export function createSecretProvider(env: Env): SecretProvider {
  if (env.SECRETS_PROVIDER === 'oci-vault') {
    return new OciVaultSecretProvider({ secretMap: parseSecretMap(env.OCI_SECRET_MAP) });
  }
  return new EnvSecretProvider();
}

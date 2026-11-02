import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
  type KeyLike,
} from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { HttpError } from './http-error';
import { jwksUri, tokenIssuer, TOKEN_AUDIENCE, verifyAccessToken } from './jwt';

/**
 * Access-token verification.
 *
 * The regression that matters here is the one that took production sessions
 * down: Supabase was switched to an asymmetric signing key, so the project began
 * issuing ES256 tokens while this module still accepted only HS256. Every real
 * session was rejected — the magic link verified, the cookies were set, the
 * browser was redirected, and the first authenticated request bounced the member
 * back to `/login`. Unit tests could not catch it because they all mint their own
 * HS256 tokens.
 *
 * So these tests pin both families, and pin the separation between them: the
 * HS256 branch must use the shared secret and the asymmetric branch must use the
 * JWKS, never the other way round. That separation is what makes branching on the
 * token's own `alg` safe, since the classic confusion forgery needs one key to
 * serve both roles.
 *
 * The claim tests at the end document the *other* half of the production fault:
 * with the Custom Access Token hook disabled in the Supabase dashboard, GoTrue
 * emits `role: "authenticated"` and omits `org_id` and `permissions`, so a
 * perfectly well-signed token is still a 401. That is deliberate — an
 * unauthorised token must not be distinguishable from an expired one — but it
 * means enabling the hook is a deployment prerequisite, not a nicety.
 */

const SUPABASE_URL = 'https://projectref.supabase.co';
const ISSUER = tokenIssuer(SUPABASE_URL);
const SECRET = 'test-project-jwt-secret-not-the-real-one';

const VALID_CLAIMS = {
  sub: '23c8e3a5-f039-42c2-8e5e-f4308ffe11db',
  role: 'super_admin',
  org_id: null,
  permissions: [],
  email: 'divine@vunvault.com',
  session_id: 'e1addb8b-4a5c-48a2-9fb3-5479b957eff5',
  aal: 'aal1',
} as const;

/** Sign with the shared secret — the legacy HS256 family. */
function signHs256(overrides: Record<string, unknown> = {}, secret = SECRET): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...VALID_CLAIMS, ...overrides })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(new TextEncoder().encode(secret));
}

let es256: { privateKey: KeyLike; jwks: ReturnType<typeof createLocalJWKSet>; publicJwk: JWK };

/** Sign with the project's asymmetric key — what Supabase actually issues now. */
async function signEs256(
  overrides: Record<string, unknown> = {},
  privateKey: KeyLike = es256.privateKey,
  kid = '826fbfcb-06e2-44a2-8642-6efb39046cbf',
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...VALID_CLAIMS, ...overrides })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid })
    .setIssuer(ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = '826fbfcb-06e2-44a2-8642-6efb39046cbf';
  publicJwk.alg = 'ES256';
  publicJwk.use = 'sig';
  es256 = {
    privateKey: privateKey as KeyLike,
    publicJwk,
    jwks: createLocalJWKSet({ keys: [publicJwk] }),
  };
});

/**
 * Sign EXACTLY the claims given, with no defaults merged in.
 *
 * The convenience signers below spread their overrides on top of `VALID_CLAIMS`,
 * which is right for "change one claim" but cannot express "omit one claim" —
 * an absent key in the override simply leaves the default in place. Tests that
 * assert a missing claim is rejected have to go through this instead.
 */
function signExactEs256(claims: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: '826fbfcb-06e2-44a2-8642-6efb39046cbf',
    })
    .setIssuer(ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(es256.privateKey);
}

/** An unsecured `alg: none` token, hand-assembled: jose refuses to sign one. */
function unsecuredToken(): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'none', typ: 'JWT' });
  const payload = b64({
    ...VALID_CLAIMS,
    iss: ISSUER,
    aud: TOKEN_AUDIENCE,
    iat: now,
    exp: now + 300,
  });
  return `${header}.${payload}.`;
}

/** The options every call uses; `jwks` is the test seam that avoids a fetch. */
const options = () => ({ secret: SECRET, issuer: ISSUER, jwks: es256.jwks });

async function expectUnauthorized(token: string): Promise<void> {
  await expect(verifyAccessToken(token, options())).rejects.toBeInstanceOf(HttpError);
  await expect(verifyAccessToken(token, options())).rejects.toMatchObject({ status: 401 });
}

describe('jwksUri', () => {
  it('derives the standard GoTrue JWKS location from the issuer', () => {
    expect(jwksUri(ISSUER)).toBe(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
  });

  it('does not double the slash when the issuer already ends in one', () => {
    expect(jwksUri(`${ISSUER}/`)).toBe(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
  });
});

describe('verifyAccessToken — the HS256 family still works', () => {
  it('accepts a correctly signed HS256 token and returns its claims', async () => {
    const verified = await verifyAccessToken(await signHs256(), options());
    expect(verified.payload.email).toBe('divine@vunvault.com');
    expect(verified.payload.role).toBe('super_admin');
    expect(verified.payload.session_id).toBe(VALID_CLAIMS.session_id);
    expect(verified.expiresAt).toBe(verified.payload.exp);
  });

  it('rejects an HS256 token signed with a different secret', async () => {
    await expectUnauthorized(await signHs256({}, 'some-other-secret'));
  });
});

describe('verifyAccessToken — the asymmetric family (the production regression)', () => {
  it('accepts an ES256 token verified against the JWKS', async () => {
    const verified = await verifyAccessToken(await signEs256(), options());
    expect(verified.payload.email).toBe('divine@vunvault.com');
    expect(verified.payload.role).toBe('super_admin');
    expect(verified.payload.aal).toBe('aal1');
  });

  it('accepts ES256 without the HS256 secret being anywhere near it', async () => {
    // The shared secret is deliberately wrong here: an asymmetric token must not
    // depend on it, and must not be verifiable with it.
    const verified = await verifyAccessToken(await signEs256(), {
      secret: 'irrelevant-and-wrong',
      issuer: ISSUER,
      jwks: es256.jwks,
    });
    expect(verified.payload.email).toBe('divine@vunvault.com');
  });

  it('rejects an ES256 token signed by a key the JWKS does not publish', async () => {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    await expectUnauthorized(await signEs256({}, privateKey as KeyLike, 'unknown-kid'));
  });
});

describe('verifyAccessToken — algorithm selection is not attacker-controlled', () => {
  it('refuses alg "none"', async () => {
    await expectUnauthorized(unsecuredToken());
  });

  it('refuses an algorithm outside both families', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ ...VALID_CLAIMS })
      .setProtectedHeader({ alg: 'HS512', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(new TextEncoder().encode(SECRET));
    await expectUnauthorized(token);
  });

  it('refuses the confusion forgery: header says HS256, signed with the public key', async () => {
    // The attack this guards against: take the *public* key material, use it as
    // an HMAC secret, and claim HS256. It only works if the verifier uses one key
    // for both roles. Here the HS256 branch uses the project secret, so the
    // signature cannot match.
    const attackerSecret = JSON.stringify(es256.publicJwk);
    await expectUnauthorized(await signHs256({}, attackerSecret));
  });

  it('refuses a malformed token without attempting crypto', async () => {
    await expectUnauthorized('not-a-jwt');
    await expectUnauthorized('');
  });
});

describe('verifyAccessToken — envelope claims', () => {
  it('rejects a wrong issuer', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ ...VALID_CLAIMS })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('https://evil.example/auth/v1')
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(new TextEncoder().encode(SECRET));
    await expectUnauthorized(token);
  });

  it('rejects a wrong audience', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ ...VALID_CLAIMS })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience('anon')
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(new TextEncoder().encode(SECRET));
    await expectUnauthorized(token);
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ ...VALID_CLAIMS })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(now - 3600)
      .setExpirationTime(now - 600)
      .sign(new TextEncoder().encode(SECRET));
    await expectUnauthorized(token);
  });
});

describe('verifyAccessToken — custom claims (the Auth Hook contract)', () => {
  it("rejects GoTrue's default role, which is not a member of the roster enum", async () => {
    // Exactly what production issues while the Custom Access Token hook is off.
    // Signature is valid; authorisation data is absent, so it must not pass.
    await expectUnauthorized(await signEs256({ role: 'authenticated' }));
  });

  it('rejects a token with no org_id', async () => {
    const { org_id: _omitted, ...withoutOrg } = VALID_CLAIMS;
    await expectUnauthorized(await signExactEs256(withoutOrg));
  });

  it('rejects a token with no permissions claim', async () => {
    const { permissions: _omitted, ...withoutPermissions } = VALID_CLAIMS;
    await expectUnauthorized(await signExactEs256(withoutPermissions));
  });

  it('rejects an unrecognised permission', async () => {
    await expectUnauthorized(await signEs256({ permissions: ['not_a_real_permission'] }));
  });

  it('accepts a token carrying a real org_id and permissions', async () => {
    const verified = await verifyAccessToken(
      await signEs256({
        role: 'admin',
        org_id: '6f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
        aal: 'aal2',
      }),
      options(),
    );
    expect(verified.payload.role).toBe('admin');
    expect(verified.payload.org_id).toBe('6f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8');
    expect(verified.payload.aal).toBe('aal2');
  });

  it('rejects a token with no session_id', async () => {
    const { session_id: _omitted, ...withoutSession } = VALID_CLAIMS;
    await expectUnauthorized(await signExactEs256(withoutSession));
  });

  it('rejects a malformed email', async () => {
    await expectUnauthorized(await signEs256({ email: 'not-an-email' }));
  });
});

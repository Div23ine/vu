import type { DisplayCurrency } from '@vunvault/contracts';
import { HttpError } from '../lib/http-error.js';
import { isLocalCurrency, toRateString, USD_RATE } from './money.js';

/**
 * Exchange-rate source for DISPLAY-ONLY quotes.
 *
 * The whole payload is cached in Redis under `fx:latest` for fifteen minutes, so a
 * quote request costs one upstream call per cache window rather than one per
 * client. When the source is unreachable and nothing is cached the request fails
 * with `502 fx_unavailable` — a display rate is never guessed, and a stale rate is
 * never served past its TTL, because the number a client is shown has to be the
 * number that was locked on their quote row.
 *
 * USD is never fetched: it is `1.00000000` by definition, and the settlement
 * currency is not exposed to an upstream outage.
 */

/** Redis key holding the cached rate payload. */
export const FX_CACHE_KEY = 'fx:latest';
/** Cache lifetime, and the default lifetime of a locked quote: 15 minutes. */
export const FX_CACHE_TTL_SECONDS = 900;
/** Upstream timeout. A rate feed that stalls must not stall a checkout. */
export const FX_TIMEOUT_MS = 4_000;

/** The narrow Redis surface the cache needs (ioredis satisfies it). */
export interface FxCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
}

export interface FxRateSource {
  /** Local major units per 1 USD, as a fixed eight-decimal string. */
  getRate(currency: DisplayCurrency): Promise<string>;
}

/** What is cached: the payload's rate table plus when it was read. */
export interface FxRatePayload {
  rates: Record<string, number | string>;
  fetchedAt: string;
}

export interface HttpFxRateSourceOptions {
  /** `FX_API_URL`, e.g. `https://open.er-api.com/v6/latest/USD`. */
  url: string;
  cache?: FxCache;
  /** Test seam. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  ttlSeconds?: number;
  now?: () => Date;
  log?: { warn: (message: string, error?: unknown) => void };
}

export class HttpFxRateSource implements FxRateSource {
  private readonly url: string;
  private readonly cache: FxCache | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly ttlSeconds: number;
  private readonly now: () => Date;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(options: HttpFxRateSourceOptions) {
    this.url = options.url;
    this.cache = options.cache;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? FX_TIMEOUT_MS;
    this.ttlSeconds = options.ttlSeconds ?? FX_CACHE_TTL_SECONDS;
    this.now = options.now ?? (() => new Date());
    this.warn = options.log?.warn.bind(options.log) ?? (() => undefined);
  }

  async getRate(currency: DisplayCurrency): Promise<string> {
    if (currency === 'USD') return USD_RATE;
    if (!isLocalCurrency(currency)) {
      throw new HttpError(
        422,
        'unsupported_currency',
        `${currency} cannot be displayed. Choose USD, KES, NGN, GHS or ZAR.`,
      );
    }

    const rates = await this.latest();
    const raw = rates[currency];
    if (raw === undefined || raw === null) {
      throw new HttpError(502, 'fx_unavailable', `The rate feed has no ${currency} rate`);
    }
    try {
      return toRateString(raw);
    } catch {
      throw new HttpError(
        502,
        'fx_unavailable',
        `The rate feed returned an unusable ${currency} rate`,
      );
    }
  }

  /** Cache first; then the network; then the cache once more before giving up. */
  private async latest(): Promise<Record<string, number | string>> {
    const cached = await this.readCache();
    if (cached !== null) return cached.rates;

    try {
      const payload = await this.fetchRates();
      await this.writeCache(payload);
      return payload.rates;
    } catch (error) {
      // Another request may have repopulated the cache while this one was in
      // flight. Serving that is correct — it is inside the same TTL window.
      const concurrent = await this.readCache();
      if (concurrent !== null) return concurrent.rates;
      this.warn('FX rate feed unavailable and no cached rates', error);
      throw new HttpError(502, 'fx_unavailable', 'Exchange rates are temporarily unavailable');
    }
  }

  private async readCache(): Promise<FxRatePayload | null> {
    if (this.cache === undefined) return null;
    try {
      const raw = await this.cache.get(FX_CACHE_KEY);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as FxRatePayload;
      if (typeof parsed !== 'object' || parsed === null || typeof parsed.rates !== 'object') {
        return null;
      }
      return parsed;
    } catch (error) {
      // A corrupt cache entry must not take checkout down: refetch instead.
      this.warn('ignoring an unreadable FX cache entry', error);
      return null;
    }
  }

  private async writeCache(payload: FxRatePayload): Promise<void> {
    if (this.cache === undefined) return;
    try {
      await this.cache.set(FX_CACHE_KEY, JSON.stringify(payload), 'EX', this.ttlSeconds);
    } catch (error) {
      // The quote still succeeds; only the next request pays for a fetch.
      this.warn('could not cache FX rates', error);
    }
  }

  private async fetchRates(): Promise<FxRatePayload> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new HttpError(
        502,
        'fx_unavailable',
        `Exchange rates are temporarily unavailable (${describeFailure(error)})`,
      );
    }
    if (!response.ok) {
      throw new HttpError(
        502,
        'fx_unavailable',
        `Exchange rates are temporarily unavailable (upstream ${response.status})`,
      );
    }

    const body: unknown = await response.json().catch(() => null);
    const rates = readRates(body);
    if (rates === null) {
      throw new HttpError(502, 'fx_unavailable', 'The rate feed returned an unusable payload');
    }
    return { rates, fetchedAt: this.now().toISOString() };
  }
}

/** `open.er-api.com` answers `{ result, base_code, rates: { KES: 129.5, … } }`. */
function readRates(body: unknown): Record<string, number | string> | null {
  if (typeof body !== 'object' || body === null) return null;
  const candidate = body as { result?: unknown; rates?: unknown };
  if (candidate.result !== undefined && candidate.result !== 'success') return null;
  const rates = candidate.rates;
  if (typeof rates !== 'object' || rates === null || Array.isArray(rates)) return null;
  return rates as Record<string, number | string>;
}

function describeFailure(error: unknown): string {
  if ((error as { name?: string } | null)?.name === 'TimeoutError') return 'timeout';
  if ((error as { name?: string } | null)?.name === 'AbortError') return 'timeout';
  return 'network error';
}

/** A source that never reaches the network: fixed rates, for tests and development. */
export class StaticFxRateSource implements FxRateSource {
  constructor(private readonly rates: Record<string, string>) {}

  async getRate(currency: DisplayCurrency): Promise<string> {
    if (currency === 'USD') return USD_RATE;
    const rate = this.rates[currency];
    if (rate === undefined) {
      throw new HttpError(502, 'fx_unavailable', `No ${currency} rate is configured`);
    }
    return rate;
  }
}

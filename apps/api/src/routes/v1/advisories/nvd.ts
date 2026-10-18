import type { NvdImportResult } from '@vunvault/contracts';
import { CVE_ID_PATTERN } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import { severityFromCvss } from './validation.js';

/**
 * The NIST National Vulnerability Database, for pre-filling the editor.
 *
 * Two rules matter more than the mapping. Imported data is NEVER auto-saved: it
 * fills the form and an analyst decides what the platform says to its clients. And
 * an upstream outage is `502 nvd_unavailable`, not a blank form that looks like
 * "no vulnerability" — the difference between those two is the reason this client
 * exists.
 *
 * Results are cached for an hour under `nvd:<cveId>`: CVE records change slowly,
 * and the API is rate-limited hard enough that a second analyst opening the same
 * CVE should not cost a request.
 */

export const NVD_BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
export const NVD_TIMEOUT_MS = 6_000;
export const NVD_CACHE_PREFIX = 'nvd:';
export const NVD_CACHE_TTL_SECONDS = 3_600;
/** The contract caps a summary at 1,200 characters. */
export const SUMMARY_MAX_LENGTH = 1_200;

/** The narrow Redis surface the cache needs. */
export interface NvdCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
}

export interface NvdClient {
  /** `null` when NVD has no such CVE. */
  getCve(cveId: string): Promise<NvdImportResult | null>;
}

export interface HttpNvdClientOptions {
  apiKey?: string;
  baseUrl?: string;
  cache?: NvdCache;
  /** Test seam. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  ttlSeconds?: number;
  log?: { warn: (message: string, error?: unknown) => void };
}

interface NvdCveDocument {
  id?: string;
  published?: string;
  descriptions?: Array<{ lang?: string; value?: string }>;
  references?: Array<{ url?: string }>;
  metrics?: {
    cvssMetricV31?: Array<{ cvssData?: { baseScore?: number; vectorString?: string } }>;
  };
  configurations?: Array<{
    nodes?: Array<{ cpeMatch?: Array<{ criteria?: string }> }>;
  }>;
}

export class HttpNvdClient implements NvdClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly cache: NvdCache | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly ttlSeconds: number;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(options: HttpNvdClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? NVD_BASE_URL;
    this.cache = options.cache;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? NVD_TIMEOUT_MS;
    this.ttlSeconds = options.ttlSeconds ?? NVD_CACHE_TTL_SECONDS;
    this.warn = options.log?.warn.bind(options.log) ?? ((): undefined => undefined);
  }

  async getCve(cveId: string): Promise<NvdImportResult | null> {
    const normalised = cveId.trim().toUpperCase();
    if (!CVE_ID_PATTERN.test(normalised)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['cveId'], message: 'Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.' },
      ]);
    }

    const key = `${NVD_CACHE_PREFIX}${normalised}`;
    const cached = await this.readCache(key);
    if (cached !== undefined) return cached;

    const document = await this.fetchCve(normalised);
    if (document === null) {
      // A "no such CVE" answer is cached too: it is a fact, and it is cheap.
      await this.writeCache(key, null);
      return null;
    }

    const result = mapDocument(normalised, document);
    await this.writeCache(key, result);
    return result;
  }

  private async readCache(key: string): Promise<NvdImportResult | null | undefined> {
    if (this.cache === undefined) return undefined;
    try {
      const raw = await this.cache.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as NvdImportResult | null;
    } catch (error) {
      this.warn('ignoring an unreadable NVD cache entry', error);
      return undefined;
    }
  }

  private async writeCache(key: string, value: NvdImportResult | null): Promise<void> {
    if (this.cache === undefined) return;
    try {
      await this.cache.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch (error) {
      this.warn('could not cache an NVD response', error);
    }
  }

  private async fetchCve(cveId: string): Promise<NvdCveDocument | null> {
    const url = `${this.baseUrl}?cveId=${encodeURIComponent(cveId)}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey !== undefined && this.apiKey !== '') headers.apiKey = this.apiKey;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw unavailable(error);
    }
    if (response.status === 404) return null;
    if (!response.ok) throw unavailable(response.status);

    const body: unknown = await response.json().catch(() => null);
    const vulnerabilities = (body as { vulnerabilities?: Array<{ cve?: NvdCveDocument }> } | null)
      ?.vulnerabilities;
    const first = vulnerabilities?.[0]?.cve;
    // NVD answers 200 with an empty list for a CVE it does not have.
    return first ?? null;
  }
}

/** NVD's document → the shape the editor pre-fills. Nothing is invented here. */
export function mapDocument(cveId: string, document: NvdCveDocument): NvdImportResult {
  const baseScore = document.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore;
  const cvss = typeof baseScore === 'number' ? Math.round(baseScore * 10) / 10 : null;
  const description =
    document.descriptions?.find((entry) => entry.lang === 'en')?.value ??
    document.descriptions?.[0]?.value ??
    null;

  return {
    cveId: document.id ?? cveId,
    vendor: vendorFromCpe(document),
    cvss,
    severity: severityFromCvss(cvss),
    disclosureDate: datePart(document.published),
    // NVD publishes no title. The analyst writes one; it is their editorial call
    // and the platform does not guess at headlines.
    title: null,
    summary: truncate(description, SUMMARY_MAX_LENGTH),
    references: (document.references ?? [])
      .map((reference) => reference.url)
      .filter((url): url is string => typeof url === 'string' && url !== ''),
  };
}

/**
 * `cpe:2.3:a:apache:struts:2.5.30:*:*:*:*:*:*:*` → `apache`.
 *
 * A CPE 2.3 URI is `cpe : version : part : vendor : product : …`, so the vendor is
 * the FOURTH field — the third is the part (`a` for an application).
 */
export function vendorFromCpe(document: NvdCveDocument): string | null {
  const criteria = document.configurations?.[0]?.nodes?.[0]?.cpeMatch?.[0]?.criteria;
  if (criteria === undefined) return null;
  const parts = criteria.split(':');
  const vendor = parts[3];
  return vendor === undefined || vendor === '' || vendor === '*' ? null : vendor;
}

/** `2026-09-30T18:15:09.123` → `2026-09-30`. */
export function datePart(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function truncate(value: string | null, max: number): string | null {
  if (value === null) return null;
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function unavailable(cause: unknown): HttpError {
  const reason = typeof cause === 'number' ? `upstream ${cause}` : 'unreachable';
  return new HttpError(502, 'nvd_unavailable', `The NVD is not answering (${reason})`);
}

/** A fixed-response client for tests and for development without an API key. */
export class StaticNvdClient implements NvdClient {
  constructor(private readonly results: Record<string, NvdImportResult | null>) {}

  async getCve(cveId: string): Promise<NvdImportResult | null> {
    const result = this.results[cveId.trim().toUpperCase()];
    return result === undefined ? null : result;
  }
}

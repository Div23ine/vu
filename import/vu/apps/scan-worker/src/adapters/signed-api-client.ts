import { createHash, createHmac } from 'node:crypto';
import type { InternalCompleteBody, InternalFailBody, InternalFinding } from '@vunvault/contracts';
import { InternalClaimResponse, InternalLogUrlResponse } from '@vunvault/contracts';
import type { ApiClient, ClaimOutcome, Clock, Logger } from '../ports';

/**
 * Signed API client (Task 84) — the controller's ONLY path to platform state.
 *
 * The controller runs where untrusted targets are scanned and holds no database
 * credentials, so its identity IS the signature. Every request carries the two
 * headers Task 40g's guard verifies:
 *
 *   x-vv-timestamp: unix milliseconds
 *   x-vv-signature: hex HMAC-SHA256(
 *     SCAN_CONTROLLER_HMAC_KEY,
 *     timestamp + "." + method + "." + path + "." + sha256hex(rawBody))
 *
 * `path` is exactly what is sent, and the body is hashed as the raw bytes that
 * go on the wire — so the JSON is serialised ONCE here and the same string is
 * both signed and sent. Re-serialising at fetch time would produce a different
 * key order and a signature the API rejects.
 *
 * Retry policy follows the spec precisely, because the two classes of call have
 * different consequences:
 *  - `complete` / `fail` are idempotent on the API (a repeat answers
 *    `409 invalid_state`, treated as success), so a 5xx is retried up to five
 *    times with exponential backoff. Losing one of these would strand a job.
 *  - Everything else is retried NEVER. A 4xx is an answer, not a hiccup, and
 *    re-posting findings could duplicate them.
 */

/** `complete` and `fail` may be retried; nothing else may. */
const RETRYABLE_ACTIONS = new Set(['complete', 'fail']);

export const MAX_RETRY_ATTEMPTS = 5;
export const RETRY_BASE_DELAY_MS = 250;

/** A repeat of an idempotent call, which the API answers with this code. */
const ALREADY_APPLIED = 'invalid_state';

export function sha256hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** The canonical signing payload — the same string Task 40g reconstructs. */
export function signaturePayload(
  timestamp: string | number,
  method: string,
  path: string,
  rawBody: string,
): string {
  return `${timestamp}.${method}.${path}.${sha256hex(rawBody)}`;
}

export function signRequest(
  key: string,
  timestamp: string | number,
  method: string,
  path: string,
  rawBody: string,
): string {
  return createHmac('sha256', key)
    .update(signaturePayload(timestamp, method, path, rawBody))
    .digest('hex');
}

type InternalAction = 'claim' | 'progress' | 'findings' | 'log-url' | 'complete' | 'fail';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export interface SignedApiClientOptions {
  baseUrl: string;
  hmacKey: string;
  clock: Clock;
  logger: Logger;
  timeoutMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export class SignedApiClient implements ApiClient {
  private readonly options: SignedApiClientOptions;
  private readonly doFetch: typeof fetch;

  constructor(options: SignedApiClientOptions) {
    this.options = options;
    this.doFetch = options.fetchImpl ?? fetch;
  }

  private pathFor(action: InternalAction, jobId: string): string {
    return `/api/v1/internal/scans/${jobId}/${action}`;
  }

  /**
   * One signed POST. The body is serialised once and reused for both the
   * signature and the wire bytes.
   */
  private async post(
    action: InternalAction,
    jobId: string,
    body: unknown,
  ): Promise<{ status: number; text: string }> {
    const path = this.pathFor(action, jobId);
    const rawBody = JSON.stringify(body ?? {});
    const url = `${this.options.baseUrl.replace(/\/$/, '')}${path}`;
    const timeoutMs = this.options.timeoutMs ?? 10_000;

    const attempts = RETRYABLE_ACTIONS.has(action) ? MAX_RETRY_ATTEMPTS : 1;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      // A fresh timestamp per attempt: the API rejects a signature older than
      // 60 s, so a retry must not reuse a stale one.
      const timestamp = this.options.clock.now();
      const response = await this.doFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vv-timestamp': String(timestamp),
          'x-vv-signature': signRequest(this.options.hmacKey, timestamp, 'POST', path, rawBody),
        },
        body: rawBody,
        signal: AbortSignal.timeout(timeoutMs),
      }).catch((error: unknown) => {
        lastError = error;
        return null;
      });

      if (response === null) {
        // A transport failure is retryable for the idempotent calls only.
        if (attempt < attempts) {
          await this.backoff(attempt, action);
          continue;
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }

      const text = await response.text();

      if (response.ok) return { status: response.status, text };

      const code = codeOf(text);
      // A repeat of an idempotent call is a success: the state already landed.
      if (RETRYABLE_ACTIONS.has(action) && code === ALREADY_APPLIED) {
        return { status: response.status, text };
      }
      // 4xx is an answer. Never retried, for any action.
      if (response.status >= 400 && response.status < 500) {
        throw new ApiRequestError(response.status, code, text.slice(0, 300));
      }
      if (attempt < attempts) {
        await this.backoff(attempt, action);
        continue;
      }
      throw new ApiRequestError(response.status, code, text.slice(0, 300));
    }

    throw lastError instanceof Error ? lastError : new Error('request failed');
  }

  private async backoff(attempt: number, action: InternalAction): Promise<void> {
    const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    this.options.logger.warn('retrying signed request', { action, attempt, delayMs: delay });
    await this.options.clock.sleep(delay);
  }

  async claim(queueJobId: string, podName?: string): Promise<ClaimOutcome> {
    try {
      const response = await this.post('claim', queueJobId, {
        queueJobId,
        ...(podName === undefined ? {} : { podName }),
      });
      const parsed = InternalClaimResponse.parse(JSON.parse(response.text));
      return {
        kind: 'claimed',
        data: {
          jobId: parsed.data.jobId,
          jobCode: parsed.data.jobCode,
          targetHost: parsed.data.targetHost,
          scanType: parsed.data.scanType,
          attempt: parsed.data.attempt,
          deadlineSeconds: parsed.data.deadlineSeconds,
        },
      };
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 409) return { kind: 'conflict' };
        // The API holds the job itself on an invalid authorisation (422).
        if (error.status === 422 && error.code === 'authorisation_invalid') {
          return { kind: 'authorisation_invalid' };
        }
      }
      throw error;
    }
  }

  async progress(jobId: string, progress: number, etaSeconds: number | null): Promise<void> {
    await this.post('progress', jobId, { progress, etaSeconds });
  }

  async findings(jobId: string, findings: readonly InternalFinding[]): Promise<void> {
    await this.post('findings', jobId, { findings });
  }

  async logUrl(
    jobId: string,
    sizeBytes: number,
  ): Promise<{ uploadUrl: string; objectKey: string }> {
    const response = await this.post('log-url', jobId, {
      contentType: 'text/plain',
      sizeBytes,
    });
    const parsed = InternalLogUrlResponse.parse(JSON.parse(response.text));
    return { uploadUrl: parsed.data.uploadUrl, objectKey: parsed.data.objectKey };
  }

  async complete(jobId: string, body: InternalCompleteBody): Promise<void> {
    await this.post('complete', jobId, body);
  }

  async fail(jobId: string, body: InternalFailBody): Promise<void> {
    await this.post('fail', jobId, body);
  }
}

/** Pull the envelope's `error` code out of a body without trusting its shape. */
function codeOf(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    return typeof parsed.error === 'string' ? parsed.error : 'unknown';
  } catch {
    return 'unknown';
  }
}

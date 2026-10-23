import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env';
import errorHandler from '../../../plugins/error-handler';
import rawBodyPlugin from '../../../plugins/raw-body';
import type { AuditEntryRow } from '../../../audit/repo';
import type { ScanAbortReason } from '@vunvault/contracts';
import internalScansRoutes from './index';
import { signInternalRequest, type NonceStore } from './hmac-auth';
import type { InternalJobRow, InternalScansRepo, NewInternalFinding, SeverityCounts } from './repo';
import type { NotifyInput } from './service';
import { createHash } from 'node:crypto';

/**
 * Internal scan-callback routes (Task 40g) — the spec's assertions: a
 * correctly signed claim succeeds and a second claim is 409; wrong signature,
 * stale timestamp and replayed signature are 401; expired authorisation → 422
 * AND the job becomes `held`; findings dedupe and the 500 cap; secrets in
 * evidence come back redacted; `complete` moves the job to `completed` +
 * gate `in_review`, appends exactly one SCAN_COMPLETE entry with the
 * formatted message, and dispatches reviewer notifications; `fail` with
 * `deadline` → `held`. (The conformance suite covers the route-table rules.)
 *
 * The harness runs the REAL guard and the REAL raw-body capture; only the
 * repo, the nonce store, the audit chain, storage and notify are faked.
 */

const TEST_KEY = 'aW50ZWdyYXRpb24tdGVzdC1obWFjLWtleS0zMmI=';
const JOB_ID = 'c4000000-0000-4000-8000-0000000000a1';
const JOB_CODE = 'JOB-4471';
const TARGET = 'api.horizonsacco.co.ke';
const NOW = new Date('2026-10-08T12:00:00Z');

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 8080,
  LOG_LEVEL: 'fatal',
  WEB_ORIGIN: 'https://www.vunvault.test',
  COOKIE_DOMAIN: '',
  API_PUBLIC_URL: 'https://api.vunvault.test',
  SECRETS_PROVIDER: 'env',
  SUPABASE_URL: 'https://project.supabase.co',
  WEBAUTHN_RP_ID: 'vunvault.test',
  WEBAUTHN_RP_NAME: 'VUNVAULT',
  R2_ACCOUNT_ID: 'r2-account',
  R2_BUCKET: 'vunvault-media',
  R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
  SENTRY_DSN: undefined,
  OCI_SECRET_MAP: undefined,
};

interface RunRow {
  attempt: number;
  queueJobId: string;
  podName: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  exitCode: number | null;
  lineCount: number;
  bytesStreamed: number;
  redactedLogKey: string | null;
  abortReason: ScanAbortReason | null;
}

class FakeInternalScansRepo implements InternalScansRepo {
  job: InternalJobRow = {
    id: JOB_ID,
    jobCode: JOB_CODE,
    targetHost: TARGET,
    scanType: 'external',
    priority: 'high',
    environment: 'production',
    status: 'queued',
    progress: 0,
    authorisationDocKey: 'authorisations/doc-1.pdf',
    authorisationExpiresAt: '2026-12-01T00:00:00Z',
    requestedBy: 'c0000000-0000-4000-8000-000000000011',
    startedAt: null,
  };
  runs: RunRow[] = [];
  findings: Array<NewInternalFinding & { jobId: string }> = [];
  reviewers = ['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002'];
  completion: Record<string, unknown> | null = null;
  failure: { cancelled: boolean; abortReason: ScanAbortReason } | null = null;

  async lockJob(jobId: string): Promise<InternalJobRow | null> {
    return jobId === this.job.id ? { ...this.job } : null;
  }
  async nextAttempt(): Promise<number> {
    return this.runs.length + 1;
  }
  async markRunning(input: {
    jobId: string;
    queueJobId: string;
    podName: string | null;
    attempt: number;
    now: Date;
  }): Promise<void> {
    this.job.status = 'running';
    this.job.startedAt = input.now.toISOString();
    this.job.progress = 0;
    this.runs.push({
      attempt: input.attempt,
      queueJobId: input.queueJobId,
      podName: input.podName,
      startedAt: input.now,
      finishedAt: null,
      exitCode: null,
      lineCount: 0,
      bytesStreamed: 0,
      redactedLogKey: null,
      abortReason: null,
    });
  }
  async markHeld(): Promise<void> {
    this.job.status = 'held';
  }
  async updateProgress(jobId: string, progress: number, etaSeconds: number | null): Promise<void> {
    if (jobId !== this.job.id || this.job.status !== 'running') return;
    if (progress > this.job.progress) this.job.progress = progress;
    void etaSeconds;
  }
  async countFindings(): Promise<number> {
    return this.findings.length;
  }
  async insertFindings(jobId: string, findings: NewInternalFinding[]): Promise<number> {
    let inserted = 0;
    for (const finding of findings) {
      const key = createHash('md5')
        .update(finding.title + (finding.cwe ?? ''))
        .digest('hex');
      const duplicate = this.findings.some(
        (existing) =>
          existing.jobId === jobId &&
          createHash('md5')
            .update(existing.title + (existing.cwe ?? ''))
            .digest('hex') === key,
      );
      if (duplicate) continue;
      this.findings.push({ ...finding, jobId });
      inserted += 1;
    }
    return inserted;
  }
  async severityCounts(): Promise<SeverityCounts> {
    const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const finding of this.findings) {
      if (finding.severity in counts) {
        counts[finding.severity as keyof SeverityCounts] += 1;
      }
    }
    return counts;
  }
  async markCompleted(input: {
    jobId: string;
    now: Date;
    exitCode: number;
    lineCount: number;
    bytesStreamed: number;
    redactedLogKey: string | null;
  }): Promise<void> {
    this.job.status = 'completed';
    this.job.progress = 100;
    this.completion = { ...input, reviewGateState: 'in_review' };
    const run = this.runs.at(-1);
    if (run !== undefined) {
      run.finishedAt = input.now;
      run.exitCode = input.exitCode;
      run.lineCount = input.lineCount;
      run.bytesStreamed = input.bytesStreamed;
      run.redactedLogKey = input.redactedLogKey;
    }
  }
  async markFailed(input: {
    jobId: string;
    now: Date;
    cancelled: boolean;
    abortReason: ScanAbortReason;
  }): Promise<void> {
    this.job.status = input.cancelled ? 'cancelled' : 'held';
    this.failure = { cancelled: input.cancelled, abortReason: input.abortReason };
    const run = this.runs.at(-1);
    if (run !== undefined) {
      run.finishedAt = input.now;
      run.abortReason = input.abortReason;
    }
  }
  async latestRun(): Promise<{ attempt: number } | null> {
    const run = this.runs.at(-1);
    return run === undefined ? null : { attempt: run.attempt };
  }
  async reviewerIds(): Promise<string[]> {
    return [...this.reviewers];
  }
}

interface Harness {
  app: FastifyInstance;
  repo: FakeInternalScansRepo;
  audits: Array<{
    eventType: string;
    message: string;
    actorLabel: string;
    subject?: string;
    details: Record<string, unknown>;
  }>;
  notifications: NotifyInput[];
  presigned: Array<{ key: string; contentType: string; maxBytes: number }>;
  nonce: NonceStore & { keys: Map<string, number> };
}

function memoryNonce(): NonceStore & { keys: Map<string, number> } {
  const keys = new Map<string, number>();
  return {
    keys,
    async setIfAbsent(key) {
      if (keys.has(key)) return false;
      keys.set(key, 1);
      return true;
    },
    async incrementBucket(key) {
      const next = (keys.get(key) ?? 0) + 1;
      keys.set(key, next);
      return next;
    },
  };
}

async function makeHarness(envOverrides: Partial<Env> = {}): Promise<Harness> {
  const repo = new FakeInternalScansRepo();
  const audits: Harness['audits'] = [];
  const notifications: NotifyInput[] = [];
  const presigned: Harness['presigned'] = [];
  const nonce = memoryNonce();

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', { ...TEST_ENV, ...envOverrides });
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');

  const fakeTx = { unsafe: async () => [] };
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);
  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      const actor = input.actor as { label: string };
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor.label,
        subject: input.subject === undefined ? undefined : String(input.subject),
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return { seq: audits.length } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);

  await app.register(rawBodyPlugin);
  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(internalScansRoutes, {
        repo,
        nonce,
        secret: TEST_KEY,
        clock: () => NOW,
        notify: async (input) => {
          notifications.push(input);
        },
        storage: {
          presignPut: async (input) => {
            presigned.push({
              key: input.key,
              contentType: input.contentType,
              maxBytes: input.maxBytes,
            });
            return { url: `https://r2.vunvault.test/signed/${input.key}`, headers: {} };
          },
        },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, notifications, presigned, nonce };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

/**
 * Strictly increasing timestamps: two calls inside the same millisecond would
 * otherwise produce an identical signature and trip the replay guard.
 */
let timestampSequence = Date.now();
function nextTimestamp(): number {
  timestampSequence += 1;
  return timestampSequence;
}

/** Sign + inject exactly the bytes the guard will hash. */
function signedInject(
  path: string,
  body: unknown,
  overrides: { timestamp?: number; key?: string; bodyOverride?: string } = {},
) {
  const raw = overrides.bodyOverride ?? JSON.stringify(body);
  const timestamp = overrides.timestamp ?? nextTimestamp();
  return harness.app.inject({
    method: 'POST',
    url: path,
    headers: {
      'content-type': 'application/json',
      'x-vv-timestamp': String(timestamp),
      'x-vv-signature': signInternalRequest(
        overrides.key ?? TEST_KEY,
        timestamp,
        'POST',
        path,
        raw,
      ),
    },
    payload: raw,
  });
}

const claimPath = `/api/v1/internal/scans/${JOB_ID}/claim`;
const progressPath = `/api/v1/internal/scans/${JOB_ID}/progress`;
const findingsPath = `/api/v1/internal/scans/${JOB_ID}/findings`;
const logUrlPath = `/api/v1/internal/scans/${JOB_ID}/log-url`;
const completePath = `/api/v1/internal/scans/${JOB_ID}/complete`;
const failPath = `/api/v1/internal/scans/${JOB_ID}/fail`;

async function claim(): Promise<void> {
  const response = await signedInject(claimPath, { queueJobId: 'bull-1', podName: 'scan-pod-1' });
  expect(response.statusCode).toBe(200);
}

describe('authentication', () => {
  it('rejects a wrong signature with 401 and audits it once', async () => {
    const response = await signedInject(claimPath, { queueJobId: 'b' }, { key: 'wrong-key' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'bad_signature' });
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({
      eventType: 'WEBHOOK_SIGNATURE_INVALID',
      actorLabel: 'scan-controller',
    });
  });

  it('rejects a stale timestamp with 401 stale', async () => {
    const response = await signedInject(
      claimPath,
      { queueJobId: 'b' },
      { timestamp: Date.now() - 120_000 },
    );
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'stale' });
  });

  it('rejects a replayed signature with 401 replay', async () => {
    const timestamp = Date.now();
    const body = { queueJobId: 'bull-replay' };
    const first = await signedInject(claimPath, body, { timestamp });
    expect(first.statusCode).toBe(200);
    const replay = await signedInject(claimPath, body, { timestamp });
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toMatchObject({ error: 'replay' });
    // The replay changed nothing: still exactly one claim, one SCAN_STARTED.
    expect(harness.repo.runs).toHaveLength(1);
    expect(harness.audits.filter((entry) => entry.eventType === 'SCAN_STARTED')).toHaveLength(1);
  });

  it('enforces SCAN_CONTROLLER_CIDRS at the route level', async () => {
    const restricted = await makeHarness({ SCAN_CONTROLLER_CIDRS: '10.0.0.0/8' });
    const raw = JSON.stringify({ queueJobId: 'b' });
    const timestamp = Date.now();
    const response = await restricted.app.inject({
      method: 'POST',
      url: claimPath,
      remoteAddress: '41.90.32.10',
      headers: {
        'content-type': 'application/json',
        'x-vv-timestamp': String(timestamp),
        'x-vv-signature': signInternalRequest(TEST_KEY, timestamp, 'POST', claimPath, raw),
      },
      payload: raw,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'forbidden' });
  });
});

describe('claim', () => {
  it('transitions queued → running, opens the run and audits SCAN_STARTED', async () => {
    const response = await signedInject(claimPath, { queueJobId: 'bull-1', podName: 'scan-pod-1' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        jobId: JOB_ID,
        jobCode: JOB_CODE,
        targetHost: TARGET,
        scanType: 'external',
        priority: 'high',
        environment: 'production',
        attempt: 1,
        deadlineSeconds: 900,
      },
    });
    expect(harness.repo.job.status).toBe('running');
    expect(harness.repo.runs[0]).toMatchObject({
      attempt: 1,
      queueJobId: 'bull-1',
      podName: 'scan-pod-1',
    });
    const started = harness.audits.filter((entry) => entry.eventType === 'SCAN_STARTED');
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ actorLabel: 'scan-controller', subject: JOB_CODE });
  });

  it('answers 409 not_claimable on a second claim', async () => {
    await claim();
    const response = await signedInject(claimPath, { queueJobId: 'bull-2' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'not_claimable' });
    expect(harness.repo.runs).toHaveLength(1);
  });

  it('holds the job and answers 422 when the authorisation expired', async () => {
    harness.repo.job.authorisationExpiresAt = '2026-10-01T00:00:00Z'; // before NOW
    const response = await signedInject(claimPath, { queueJobId: 'bull-1' });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'authorisation_invalid' });
    // The hold survives the 422 (own transaction).
    expect(harness.repo.job.status).toBe('held');
    expect(harness.audits.filter((entry) => entry.eventType === 'SCAN_STARTED')).toHaveLength(0);
  });

  it('holds the job when no authorisation document exists', async () => {
    harness.repo.job.authorisationDocKey = null;
    const response = await signedInject(claimPath, { queueJobId: 'bull-1' });
    expect(response.statusCode).toBe(422);
    expect(harness.repo.job.status).toBe('held');
  });

  it('answers 404 for an unknown job', async () => {
    const unknown = `/api/v1/internal/scans/c4000000-0000-4000-8000-0000000000ff/claim`;
    const response = await signedInject(unknown, { queueJobId: 'bull-1' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });
});

describe('progress', () => {
  it('is monotonic and only while running', async () => {
    // Not running yet.
    const early = await signedInject(progressPath, { progress: 10, etaSeconds: null });
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: 'invalid_state' });

    await claim();
    const up = await signedInject(progressPath, { progress: 40, etaSeconds: 120 });
    expect(up.statusCode).toBe(204);
    expect(harness.repo.job.progress).toBe(40);

    const down = await signedInject(progressPath, { progress: 30, etaSeconds: 900 });
    expect(down.statusCode).toBe(204);
    expect(harness.repo.job.progress).toBe(40); // lower value ignored
    expect(harness.audits.filter((entry) => entry.eventType !== 'SCAN_STARTED')).toHaveLength(0);
  });

  it('rejects progress 100 (complete owns the final state)', async () => {
    await claim();
    const response = await signedInject(progressPath, { progress: 100, etaSeconds: null });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_failed' });
  });
});

describe('findings', () => {
  const finding = {
    severity: 'critical',
    title: 'SQL injection in search',
    description: 'Unsanitised input reaches the query planner.',
    evidenceRedacted: 'GET /search?q=1 Authorization: Bearer abc123supersecret',
    cvss: 9.8,
    cwe: 'CWE-89',
  };

  it('stores findings, redacts credential-shaped evidence', async () => {
    await claim();
    const response = await signedInject(findingsPath, { findings: [finding] });
    expect(response.statusCode).toBe(204);
    expect(harness.repo.findings).toHaveLength(1);
    const stored = harness.repo.findings[0];
    expect(stored?.evidenceRedacted).toContain('[REDACTED]');
    expect(stored?.evidenceRedacted).not.toContain('abc123supersecret');
    expect(stored?.cwe).toBe('CWE-89');
  });

  it('dedupes repeated (title, cwe) pairs', async () => {
    await claim();
    await signedInject(findingsPath, { findings: [finding] });
    const again = await signedInject(findingsPath, { findings: [finding] });
    expect(again.statusCode).toBe(204);
    expect(harness.repo.findings).toHaveLength(1);
  });

  it('enforces the 500-findings-per-job cap with 422', async () => {
    await claim();
    for (let index = 0; index < 499; index += 1) {
      harness.repo.findings.push({
        jobId: JOB_ID,
        severity: 'low',
        title: `filler-${index}`,
        description: 'filler',
        evidenceRedacted: null,
        cvss: null,
        cwe: null,
        remediationGuidance: null,
      });
    }
    const overCap = await signedInject(findingsPath, {
      findings: [finding, { ...finding, title: 'Second critical' }],
    });
    expect(overCap.statusCode).toBe(422);
    expect(overCap.json()).toMatchObject({ error: 'too_many_findings' });
    expect(harness.repo.findings).toHaveLength(499);
  });

  it('rejects more than 100 findings per call', async () => {
    await claim();
    const many = Array.from({ length: 101 }, (_, index) => ({ ...finding, title: `t-${index}` }));
    const response = await signedInject(findingsPath, { findings: many });
    expect(response.statusCode).toBe(400);
  });
});

describe('log-url', () => {
  it('presigns scan-logs/<jobId>/<attempt>.log', async () => {
    await claim();
    const response = await signedInject(logUrlPath, {
      contentType: 'text/plain',
      sizeBytes: 1024,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: { uploadUrl: string; objectKey: string; expiresAt: string };
    };
    expect(body.data.objectKey).toBe(`scan-logs/${JOB_ID}/1.log`);
    expect(body.data.uploadUrl).toContain('https://r2.vunvault.test/signed/');
    expect(harness.presigned[0]).toMatchObject({
      key: `scan-logs/${JOB_ID}/1.log`,
      contentType: 'text/plain',
      maxBytes: 1024,
    });
  });

  it('rejects an oversize archive', async () => {
    await claim();
    const response = await signedInject(logUrlPath, {
      contentType: 'text/plain',
      sizeBytes: 6 * 1024 * 1024,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('complete', () => {
  async function seedCompleted(
    severityMix: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'critical', 'high'],
  ) {
    harness.repo.job.startedAt = '2026-10-08T11:55:53Z'; // NOW − 247 s → 4 m 07 s
    await claim();
    harness.repo.job.startedAt = '2026-10-08T11:55:53Z'; // claim overwrote it with NOW
    severityMix.forEach((severity, index) => {
      harness.repo.findings.push({
        jobId: JOB_ID,
        severity,
        title: `finding-${index}`,
        description: 'x',
        evidenceRedacted: null,
        cvss: null,
        cwe: null,
        remediationGuidance: null,
      });
    });
    return signedInject(completePath, {
      exitCode: 0,
      lineCount: 1200,
      bytesStreamed: 98_765,
      redactedLogKey: `scan-logs/${JOB_ID}/1.log`,
    });
  }

  it('completes the job, gates it in_review and formats the audit message', async () => {
    const response = await seedCompleted();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        jobCode: JOB_CODE,
        findings: { critical: 2, high: 1, medium: 0, low: 0 },
      },
    });
    expect(harness.repo.job.status).toBe('completed');
    expect(harness.repo.job.progress).toBe(100);
    expect(harness.repo.completion).toMatchObject({ reviewGateState: 'in_review', exitCode: 0 });

    const completes = harness.audits.filter((entry) => entry.eventType === 'SCAN_COMPLETE');
    expect(completes).toHaveLength(1);
    expect(completes[0]?.message).toBe(
      `${JOB_CODE} against ${TARGET} finished in 4 m 07 s · 3 findings (2 critical, 1 high)`,
    );
    expect(completes[0]?.actorLabel).toBe('scan-controller');
  });

  it('notifies reviewers, and admins again on critical findings', async () => {
    await seedCompleted();
    const review = harness.notifications.filter((n) => n.event === 'job_awaiting_review');
    const critical = harness.notifications.filter((n) => n.event === 'critical_finding');
    expect(review).toHaveLength(2);
    expect(review.every((n) => n.critical === false)).toBe(true);
    expect(critical).toHaveLength(2);
    expect(critical.every((n) => n.critical === true)).toBe(true);
  });

  it('skips the critical_finding wave without critical findings', async () => {
    await seedCompleted(['medium', 'low']);
    expect(harness.notifications.filter((n) => n.event === 'critical_finding')).toHaveLength(0);
    expect(harness.notifications.filter((n) => n.event === 'job_awaiting_review')).toHaveLength(2);
  });

  it('answers 409 from any state but running', async () => {
    const response = await signedInject(completePath, {
      exitCode: 0,
      lineCount: 0,
      bytesStreamed: 0,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'invalid_state' });
  });
});

describe('fail', () => {
  it('deadline → held + SCAN_FAILED + the requester notification', async () => {
    await claim();
    const response = await signedInject(failPath, {
      reason: 'The 900 s deadline elapsed during the nuclei phase',
      abortReason: 'deadline',
    });
    expect(response.statusCode).toBe(204);
    expect(harness.repo.job.status).toBe('held');
    expect(harness.repo.failure).toMatchObject({ cancelled: false, abortReason: 'deadline' });
    const failed = harness.audits.filter((entry) => entry.eventType === 'SCAN_FAILED');
    expect(failed).toHaveLength(1);
    expect(harness.notifications).toEqual([
      expect.objectContaining({
        userId: 'c0000000-0000-4000-8000-000000000011',
        event: 'scan_completed',
        title: 'Scan could not be completed',
      }),
    ]);
  });

  it('abort → cancelled + SCAN_CANCELLED', async () => {
    await claim();
    const response = await signedInject(failPath, {
      reason: 'Operator aborted from the queue',
      abortReason: 'abort',
    });
    expect(response.statusCode).toBe(204);
    expect(harness.repo.job.status).toBe('cancelled');
    expect(harness.audits.filter((entry) => entry.eventType === 'SCAN_CANCELLED')).toHaveLength(1);
  });

  it('works from queued too (a job can die before it starts)', async () => {
    const response = await signedInject(failPath, {
      reason: 'Pod could not be scheduled',
      abortReason: 'error',
    });
    expect(response.statusCode).toBe(204);
    expect(harness.repo.job.status).toBe('held');
  });
});

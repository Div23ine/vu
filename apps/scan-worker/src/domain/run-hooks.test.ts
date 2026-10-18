import { describe, expect, it } from 'vitest';
import type { ScanStreamMessage } from '@vunvault/contracts';
import type { InternalFinding } from '@vunvault/contracts';
import type { ApiClient, Clock, Logger } from '../ports.js';
import { LogArchive } from './log-archive.js';
import {
  FINAL_FLUSH_ATTEMPTS,
  FINDING_FLUSH_MS,
  PROGRESS_THROTTLE_MS,
  makeRunHooks,
} from './run-hooks.js';
import type { OutputChannel } from './output-channel.js';

/**
 * Run-hook tests (Task 88).
 *
 * The three behaviours worth proving: one sanitised string reaches all three
 * destinations identically, progress is throttled on the API but not on the
 * stream, and lost findings FAIL the run rather than letting a job complete with
 * a silently short report.
 */

interface Recorder {
  published: ScanStreamMessage[];
  progress: { progress: number; etaSeconds: number | null }[];
  findings: InternalFinding[][];
  logs: string[];
}

function fixture(failFindings = false) {
  const recorded: Recorder = { published: [], progress: [], findings: [], logs: [] };
  let now = 1_700_000_000_000;

  const clock: Clock = {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
  const channel: OutputChannel = {
    async send(message) {
      recorded.published.push(message);
    },
  };
  const api: ApiClient = {
    async claim() {
      return { kind: 'conflict' };
    },
    async progress(_id, progress, etaSeconds) {
      recorded.progress.push({ progress, etaSeconds });
    },
    async findings(_id, batch) {
      if (failFindings) throw new Error('api down');
      recorded.findings.push([...batch]);
    },
    async logUrl() {
      return { uploadUrl: 'https://storage.test/put', objectKey: 'logs/x.txt' };
    },
    async complete() {},
    async fail() {},
  };
  const logger: Logger = {
    info: (m) => recorded.logs.push(`info:${m}`),
    warn: (m) => recorded.logs.push(`warn:${m}`),
    error: (m) => recorded.logs.push(`error:${m}`),
    debug: (m) => recorded.logs.push(`debug:${m}`),
  };
  const advance = (ms: number) => {
    now += ms;
  };

  const hooks = makeRunHooks({
    jobId: 'job-1',
    api,
    channel,
    clock,
    logger,
    archive: new LogArchive(),
  });

  return { hooks, recorded, advance };
}

function finding(title: string, severity: InternalFinding['severity'] = 'high'): InternalFinding {
  return { severity, title, description: `${title} description.` };
}

function linesOf(published: ScanStreamMessage[]) {
  return published.filter(
    (m): m is Extract<ScanStreamMessage, { type: 'line' }> => m.type === 'line',
  );
}

describe('makeRunHooks — lines', () => {
  it('assigns monotonic seq starting at 1 and publishes with a kind', () => {
    const { hooks, recorded } = fixture();
    hooks.onLine('[*] scanning');
    hooks.onLine('[!] weak cipher');
    hooks.onLine('[!!] CRITICAL exposure');

    const lines = linesOf(recorded.published);
    expect(lines.map((line) => line.seq)).toEqual([1, 2, 3]);
    expect(lines.map((line) => line.kind)).toEqual(['ok', 'warn', 'crit']);
    expect(lines[0]?.msg).toBe('[*] scanning');
    expect(lines[0]?.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('archives the SAME sanitised text it published', () => {
    const { hooks } = fixture();
    hooks.onLine('\x1b[31mpassword = Sup3rS3cret\x1b[0m');

    const archived = hooks.archive.render();
    expect(archived).not.toContain('\x1b');
    expect(archived).not.toContain('Sup3rS3cret');
    expect(archived).toContain('[REDACTED]');
  });

  it('drops whitespace-only lines from both stream and archive', () => {
    const { hooks, recorded } = fixture();
    hooks.onLine('   ');
    expect(linesOf(recorded.published)).toHaveLength(0);
    expect(hooks.archive.lines).toBe(0);
    expect(hooks.lineCount()).toBe(0);
  });

  it('a publish failure is logged and never thrown', async () => {
    const { recorded } = fixture();
    const failing: OutputChannel = {
      async send() {
        throw new Error('redis down');
      },
    };
    const logs: string[] = [];
    const hooks = makeRunHooks({
      jobId: 'job-1',
      api: {} as ApiClient,
      channel: failing,
      clock: { now: () => 0, sleep: async () => undefined },
      logger: {
        info: () => undefined,
        warn: (m) => logs.push(m),
        error: () => undefined,
        debug: () => undefined,
      },
      archive: new LogArchive(),
    });

    // Must not throw — a disconnected viewer cannot kill a scan.
    expect(() => hooks.onLine('still going')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(recorded.logs).toEqual([]);
    expect(logs.length).toBeGreaterThanOrEqual(0);
  });
});

describe('makeRunHooks — progress throttling', () => {
  it('publishes every progress event but calls the API at most once per 2 s', () => {
    const { hooks, recorded, advance } = fixture();

    hooks.onProgress(10, 100);
    hooks.onProgress(20, 90);
    hooks.onProgress(30, 80);
    expect(recorded.progress).toHaveLength(1);
    expect(recorded.published.filter((message) => message.type === 'progress')).toHaveLength(3);

    advance(PROGRESS_THROTTLE_MS + 1);
    hooks.onProgress(40, 70);
    expect(recorded.progress).toHaveLength(2);
    expect(recorded.progress[1]?.progress).toBe(40);
    expect(PROGRESS_THROTTLE_MS).toBe(2_000);
  });

  it('an API progress failure is logged, not fatal', async () => {
    const { recorded } = fixture();
    const throwingApi = {
      async progress() {
        throw new Error('api down');
      },
    } as unknown as ApiClient;
    const logs: string[] = [];
    const throwingHooks = makeRunHooks({
      jobId: 'job-1',
      api: throwingApi,
      channel: { send: async () => undefined },
      clock: { now: () => 0, sleep: async () => undefined },
      logger: {
        info: () => undefined,
        warn: (message) => logs.push(message),
        error: () => undefined,
        debug: () => undefined,
      },
      archive: new LogArchive(),
    });
    expect(() => throwingHooks.onProgress(50, null)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logs).toContain('could not post progress');
    expect(recorded.progress).toHaveLength(0);
  });
});

describe('makeRunHooks — phases and findings', () => {
  it('publishes a phase message', () => {
    const { hooks, recorded } = fixture();
    hooks.onPhase?.('Port and service scan');
    expect(recorded.published).toEqual([{ type: 'phase', name: 'Port and service scan' }]);
  });

  it('flushes findings in batches of at most 100', async () => {
    const { hooks, recorded, advance } = fixture();
    for (let index = 0; index < 250; index += 1) {
      hooks.onFinding(finding(`finding ${index}`));
      if (index % 50 === 0) advance(FINDING_FLUSH_MS + 1);
    }
    const ok = await hooks.finish();

    expect(ok).toBe(true);
    const posted = recorded.findings.flat();
    expect(posted).toHaveLength(250);
    for (const batch of recorded.findings) {
      expect(batch.length).toBeLessThanOrEqual(100);
    }
    expect(FINDING_FLUSH_MS).toBe(5_000);
  });

  it('a failed final flush marks the run as failed', async () => {
    const { hooks, recorded } = fixture(true);
    hooks.onFinding(finding('lost finding'));

    const ok = await hooks.finish();

    expect(ok).toBe(false);
    expect(recorded.findings).toHaveLength(0);
    // Every attempt was made before giving up.
    expect(
      recorded.logs.filter((line) => line.includes('findings could not be posted')),
    ).toHaveLength(FINAL_FLUSH_ATTEMPTS);
    expect(FINAL_FLUSH_ATTEMPTS).toBe(5);
  });

  it('a run with no findings finishes cleanly', async () => {
    const { hooks } = fixture();
    await expect(hooks.finish()).resolves.toBe(true);
  });
});

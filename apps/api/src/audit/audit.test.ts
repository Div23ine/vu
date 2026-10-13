import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { canonicalJson, CanonicalJsonError } from './canonical';
import {
  computeHash,
  computeSignature,
  digestsEqual,
  encodeKey,
  openWith,
  parseKeyRing,
  randomNonce,
  sealWith,
  ZERO_HASH,
  type AuditKeyRing,
} from './crypto';
import {
  actorLabelFor,
  audited,
  buildAuditInput,
  defaultActor,
  isAudited,
  type AuditSpec,
} from './audited';
import type { Tx } from '../plugins/db';
import {
  AUDIT_SEV1_CHANNEL,
  AUDIT_STREAM_CHANNEL,
  AuditService,
  checkEntry,
  entryPayload,
  redactDetails,
  verifyEntries,
  type AuditEntryView,
} from './service';
import { asExecutor, type SqlExecutor } from './repo';
import errorHandler from '../plugins/error-handler';
import { HttpError } from '../lib/http-error';

/** An in-memory `audit_entries` table that speaks the exact SQL the repo emits. */
interface StoredRow {
  seq: number;
  id: string;
  category: string;
  event_type: string;
  severity: string;
  sev_level: number | null;
  actor_id: string | null;
  actor_label: string;
  ip: string | null;
  subject: string | null;
  message: string;
  details: Record<string, unknown>;
  sealed_details: Buffer | null;
  nonce: Buffer | null;
  prev_hash: string;
  hash: string;
  signature: string;
  key_id: string;
  created_at: Date;
}

class FakeAuditStore {
  readonly rows: StoredRow[] = [];
  readonly statements: string[] = [];
  readonly executor: SqlExecutor;

  constructor() {
    this.executor = {
      unsafe: async <T>(sql: string, params?: unknown[]): Promise<T> =>
        this.run(sql, params ?? []) as T,
    };
  }

  private run(sql: string, params: unknown[]): unknown {
    this.statements.push(sql);

    if (sql.includes('pg_advisory_xact_lock')) {
      expect(params[0]).toBe(7340481);
      return [];
    }
    if (sql.includes('order by seq desc limit 1') && !sql.includes('where seq <')) {
      const last = this.rows[this.rows.length - 1];
      return last === undefined ? [] : [{ seq: String(last.seq), hash: last.hash }];
    }
    if (sql.includes('where seq <')) {
      const before = Number(params[0]);
      const candidate = [...this.rows].reverse().find((row) => row.seq < before);
      return candidate === undefined ? [] : [candidate];
    }
    if (sql.includes('insert into audit_entries')) {
      const seq = this.rows.length + 1;
      this.rows.push({
        seq,
        id: String(params[0]),
        category: String(params[1]),
        event_type: String(params[2]),
        severity: String(params[3]),
        sev_level: params[4] as number | null,
        actor_id: params[5] as string | null,
        actor_label: String(params[6]),
        ip: params[7] as string | null,
        subject: params[8] as string | null,
        message: String(params[9]),
        details: JSON.parse(String(params[10])) as Record<string, unknown>,
        sealed_details: params[11] as Buffer | null,
        nonce: params[12] as Buffer | null,
        prev_hash: String(params[13]),
        hash: String(params[14]),
        signature: String(params[15]),
        key_id: String(params[16]),
        created_at: params[17] as Date,
      });
      return [{ seq: String(seq) }];
    }
    if (sql.includes('where seq >')) {
      const afterSeq = Number(params[0]);
      const hasUpper = sql.includes('and seq <=');
      const toSeq = hasUpper ? Number(params[1]) : undefined;
      const limit = Number(params[hasUpper ? 2 : 1]);
      return this.rows
        .filter((row) => row.seq > afterSeq && (toSeq === undefined || row.seq <= toSeq))
        .slice(0, limit);
    }
    throw new Error(`unexpected SQL: ${sql}`);
  }

  toRow(index: number): StoredRow {
    const row = this.rows[index];
    if (row === undefined) throw new Error(`no row at ${index}`);
    return row;
  }
}

function ring(keys: Record<string, Buffer>, currentKeyId: string): AuditKeyRing {
  return {
    currentKeyId,
    key: (keyId) => keys[keyId],
    keyIds: () => Object.keys(keys),
  };
}

const KEY_V1 = Buffer.alloc(32, 7);
const KEY_V2 = Buffer.alloc(32, 9);
const AES_V1 = Buffer.alloc(32, 3);

function makeService(
  options: {
    hmac?: AuditKeyRing;
    aes?: AuditKeyRing;
    published?: Array<{ channel: string; view: AuditEntryView }>;
    at?: string;
  } = {},
): AuditService {
  return new AuditService({
    hmac: options.hmac ?? ring({ v1: KEY_V1 }, 'v1'),
    aes: options.aes,
    now: () => new Date(options.at ?? '2026-09-24T12:00:00.000Z'),
    publish:
      options.published === undefined
        ? undefined
        : (channel, payload) => {
            options.published?.push({ channel, view: JSON.parse(payload) as AuditEntryView });
          },
  });
}

function rowToEntry(row: StoredRow) {
  return {
    seq: row.seq,
    id: row.id,
    category: row.category,
    eventType: row.event_type,
    severity: row.severity,
    sevLevel: row.sev_level,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    ip: row.ip,
    subject: row.subject,
    message: row.message,
    details: row.details,
    sealedDetails: row.sealed_details,
    nonce: row.nonce,
    prevHash: row.prev_hash,
    hash: row.hash,
    signature: row.signature,
    keyId: row.key_id,
    createdAt: row.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('canonical JSON', () => {
  it('ignores key order at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 4 }, b: 1 }),
    );
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('renders dates as ISO-8601 UTC with milliseconds', () => {
    expect(canonicalJson({ at: new Date('2026-09-24T09:41:12Z') })).toBe(
      '{"at":"2026-09-24T09:41:12.000Z"}',
    );
  });

  it('drops undefined object keys and nulls them inside arrays', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(canonicalJson([1, undefined, 3])).toBe('[1,null,3]');
  });

  it('rejects values that have no deterministic encoding', () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ n: Number.POSITIVE_INFINITY })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ n: 10n })).toThrow(CanonicalJsonError);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow(/cycle/);
  });
});

describe('audit crypto', () => {
  it('hashes prev_hash concatenated with the payload', () => {
    expect(computeHash(ZERO_HASH, '{}')).toBe(
      // sha256_hex(64 zeros + "{}")
      computeHash(ZERO_HASH, '{}'),
    );
    expect(computeHash(ZERO_HASH, '{}')).toHaveLength(64);
    expect(computeHash(ZERO_HASH, '{}')).not.toBe(computeHash(ZERO_HASH, '{"a":1}'));
    expect(digestsEqual(computeHash(ZERO_HASH, '{}'), computeHash(ZERO_HASH, '{}'))).toBe(true);
    expect(digestsEqual('aa', 'aaa')).toBe(false);
  });

  it('signs with HMAC-SHA256 and produces 64 hex characters', () => {
    const signature = computeSignature(KEY_V1, 'deadbeef');
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(signature).not.toBe(computeSignature(KEY_V2, 'deadbeef'));
  });

  it('never reuses a nonce', () => {
    const nonces = new Set<string>();
    for (let index = 0; index < 1000; index += 1) nonces.add(randomNonce().toString('hex'));
    expect(nonces.size).toBe(1000);
    expect([...nonces][0]).toHaveLength(24);
  });

  it('parses a bare key and a keyed ring, and rejects a short key', () => {
    const bare = parseKeyRing(encodeKey(KEY_V1), 'AUDIT_HMAC_KEY');
    expect(bare.currentKeyId).toBe('v1');
    expect(bare.key('v1')).toEqual(KEY_V1);

    const keyed = parseKeyRing(
      JSON.stringify({ current: 'v2', keys: { v1: encodeKey(KEY_V1), v2: encodeKey(KEY_V2) } }),
      'AUDIT_HMAC_KEY',
    );
    expect(keyed.currentKeyId).toBe('v2');
    expect(keyed.keyIds().sort()).toEqual(['v1', 'v2']);
    expect(keyed.key('v1')).toEqual(KEY_V1);

    expect(() => parseKeyRing(encodeKey(Buffer.alloc(16, 1)), 'AUDIT_HMAC_KEY')).toThrow(
      /32 bytes/,
    );
    expect(() =>
      parseKeyRing(
        JSON.stringify({ current: 'v3', keys: { v1: encodeKey(KEY_V1) } }),
        'AUDIT_AES_KEY',
      ),
    ).toThrow(/not in the ring/);
  });

  it('seals and opens a payload, bound to the entry id', () => {
    const blob = sealWith(AES_V1, { cardLast4: '4290' }, 'entry-1');
    expect(blob.nonce).toHaveLength(12);
    expect(openWith(AES_V1, blob.sealed, blob.nonce, 'entry-1')).toEqual({ cardLast4: '4290' });

    // Bound to the entry: the same blob under another id fails authentication.
    expect(() => openWith(AES_V1, blob.sealed, blob.nonce, 'entry-2')).toThrow();
    // A flipped tag bit is detected.
    const tampered = Buffer.from(blob.sealed);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] as number) ^ 0xff;
    expect(() => openWith(AES_V1, tampered, blob.nonce, 'entry-1')).toThrow();
    // A flipped ciphertext bit is detected too.
    const flipped = Buffer.from(blob.sealed);
    flipped[0] = (flipped[0] as number) ^ 0x01;
    expect(() => openWith(AES_V1, flipped, blob.nonce, 'entry-1')).toThrow();
  });
});

describe('redaction', () => {
  it('drops credential-shaped keys at every depth and keeps the rest', () => {
    const redacted = redactDetails({
      password: 'hunter2',
      currentPassword: 'hunter1',
      newPassword: 'hunter3',
      confirmPassword: 'hunter3',
      pass: 'x',
      secret: 's',
      accessToken: 't',
      authorization: 'Bearer x',
      cookie: 'vv_at=x',
      cvc: '123',
      pan: '4242424242424242',
      recoveryCode: 'K7QX-2M9F-4TWA',
      jobCode: 'JOB-4471',
      keep: 'me',
      nested: { token: 'x', note: 'stays', deeper: { secret: 'y', ok: true } },
      list: [{ password: 'z', fine: 1 }],
    }) as Record<string, unknown>;

    for (const dropped of [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'pass',
      'secret',
      'accessToken',
      'authorization',
      'cookie',
      'cvc',
      'pan',
      'recoveryCode',
      'jobCode',
    ]) {
      expect(redacted, dropped).not.toHaveProperty(dropped);
    }
    expect(redacted.keep).toBe('me');
    expect(redacted.nested).toEqual({ note: 'stays', deeper: { ok: true } });
    expect(redacted.list).toEqual([{ fine: 1 }]);
  });
});

describe('AuditService.append', () => {
  it('builds a verifiable chain over sequential appends', async () => {
    const store = new FakeAuditStore();
    const service = makeService();

    for (const message of ['first entry', 'second entry', 'third entry']) {
      await service.append(store.executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: null, label: 'system' },
        message,
      });
    }

    expect(store.rows).toHaveLength(3);
    expect(store.rows[0]?.prev_hash).toBe(ZERO_HASH);
    expect(store.rows[1]?.prev_hash).toBe(store.rows[0]?.hash);
    expect(store.rows[2]?.prev_hash).toBe(store.rows[1]?.hash);
    // The advisory lock is taken before the head is read, on every append.
    expect(store.statements.filter((sql) => sql.includes('pg_advisory_xact_lock'))).toHaveLength(3);

    const outcome = await service.verify(store.executor);
    expect(outcome).toMatchObject({
      checkedFromSeq: 1,
      checkedToSeq: 3,
      entries: 3,
      mismatches: 0,
    });
    expect(outcome.firstMismatchSeq).toBeNull();
  });

  it('takes the category and severity from the catalog', async () => {
    const store = new FakeAuditStore();
    await makeService().append(store.executor, {
      eventType: 'ADVISORY_BROADCAST',
      actor: { id: null, label: 'f.hassan' },
      message: 'CVE-2026-21447 emergency advisory pushed to 312 client dashboards',
    });
    const row = store.toRow(0);
    expect(row.category).toBe('administrative');
    expect(row.severity).toBe('critical');
    expect(row.sev_level).toBe(1);
  });

  it('allows severity to be raised but never lowered', async () => {
    const store = new FakeAuditStore();
    const service = makeService();
    await service.append(store.executor, {
      eventType: 'AUTH_SUCCESS',
      actor: { id: null, label: 'system' },
      message: 'raised',
      severity: 'critical',
      sevLevel: 2,
    });
    await service.append(store.executor, {
      eventType: 'ADVISORY_BROADCAST',
      actor: { id: null, label: 'system' },
      message: 'lowered',
      severity: 'info',
      sevLevel: 3,
    });
    expect(store.toRow(0).severity).toBe('critical');
    expect(store.toRow(0).sev_level).toBe(2);
    expect(store.toRow(1).severity).toBe('critical');
    expect(store.toRow(1).sev_level).toBe(1);
  });

  it('redacts credential-shaped details before hashing', async () => {
    const store = new FakeAuditStore();
    await makeService().append(store.executor, {
      eventType: 'AUTH_FAILURE',
      actor: { id: null, label: 'external' },
      message: 'Login attempt denied',
      details: { password: 'hunter2', recoveryCode: 'K7QX-2M9F-4TWA', email: 'a@b.co' },
    });
    const details = store.toRow(0).details;
    expect(details).toEqual({ email: 'a@b.co' });
    expect(JSON.stringify(details)).not.toContain('hunter2');
  });

  it('seals sensitive fields and opens them with the entry id', async () => {
    const store = new FakeAuditStore();
    const service = makeService({ aes: ring({ v1: AES_V1 }, 'v1') });
    const row = await service.append(store.executor, {
      eventType: 'AUTH_SUCCESS',
      actor: { id: null, label: 'a.njoroge' },
      message: 'Signed in',
      sealed: { sourceIp: '41.90.32.10', userAgent: 'Safari' },
    });
    expect(row.sealedDetails).not.toBeNull();
    expect(row.nonce).toHaveLength(12);
    expect(service.open(row)).toEqual({ sourceIp: '41.90.32.10', userAgent: 'Safari' });
    // The plaintext never appears in the row.
    expect(JSON.stringify(store.toRow(0).details)).not.toContain('41.90.32.10');
  });

  it('refuses to seal without an AES key rather than storing plaintext', async () => {
    const store = new FakeAuditStore();
    await expect(
      makeService().append(store.executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: null, label: 'system' },
        message: 'x',
        sealed: { secretThing: 1 },
      }),
    ).rejects.toThrow(/AUDIT_AES_KEY is not configured/);
    expect(store.rows).toHaveLength(0);
  });

  it('publishes to the stream, and to the SEV-1 channel for a level-1 entry', async () => {
    const store = new FakeAuditStore();
    const published: Array<{ channel: string; view: AuditEntryView }> = [];
    const service = makeService({ published });

    await service.append(store.executor, {
      eventType: 'AUTH_SUCCESS',
      actor: { id: null, label: 'system' },
      message: 'routine',
    });
    expect(published.map((entry) => entry.channel)).toEqual([AUDIT_STREAM_CHANNEL]);

    await service.append(store.executor, {
      eventType: 'ADVISORY_BROADCAST',
      actor: { id: null, label: 'f.hassan' },
      message: 'emergency',
    });
    expect(published.map((entry) => entry.channel)).toEqual([
      AUDIT_STREAM_CHANNEL,
      AUDIT_STREAM_CHANNEL,
      AUDIT_SEV1_CHANNEL,
    ]);
    expect(published[2]?.view.eventType).toBe('ADVISORY_BROADCAST');
  });

  it('swallows a publish failure so a committed write is never lost', async () => {
    const store = new FakeAuditStore();
    const service = new AuditService({
      hmac: ring({ v1: KEY_V1 }, 'v1'),
      publish: async () => {
        throw new Error('redis down');
      },
    });
    await expect(
      service.append(store.executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: null, label: 'system' },
        message: 'still recorded',
      }),
    ).resolves.toBeDefined();
    expect(store.rows).toHaveLength(1);
  });
});

describe('AuditService.verify', () => {
  async function buildChain(count = 3): Promise<{ store: FakeAuditStore; service: AuditService }> {
    const store = new FakeAuditStore();
    const service = makeService();
    for (let index = 0; index < count; index += 1) {
      await service.append(store.executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: null, label: 'system' },
        message: `entry ${index + 1}`,
      });
    }
    return { store, service };
  }

  it('reports the exact seq where a rewritten message breaks the chain', async () => {
    const { store, service } = await buildChain();
    const target = store.toRow(1);
    target.message = `${target.message} (rewritten)`;

    const outcome = await service.verify(store.executor);
    expect(outcome.mismatches).toBe(1);
    expect(outcome.firstMismatchSeq).toBe(2);
    expect(outcome.entries).toBe(3);
  });

  it('reports a broken link when prev_hash is rewritten', async () => {
    const { store, service } = await buildChain();
    store.toRow(2).prev_hash = ZERO_HASH;
    const outcome = await service.verify(store.executor);
    expect(outcome.firstMismatchSeq).toBe(3);
    const issues = verifyEntries(store.rows.map(rowToEntry), (keyId) =>
      keyId === 'v1' ? KEY_V1 : undefined,
    );
    expect(issues.issues[0]?.reason).toBe('link');
  });

  it('fails the signature check with the wrong HMAC key', async () => {
    const { store } = await buildChain();
    const wrongKey = makeService({ hmac: ring({ v1: Buffer.alloc(32, 42) }, 'v1') });
    const outcome = await wrongKey.verify(store.executor);
    expect(outcome.mismatches).toBe(3);
    expect(outcome.firstMismatchSeq).toBe(1);
    expect(verifyEntries(store.rows.map(rowToEntry), () => undefined).issues[0]?.reason).toBe(
      'signature',
    );
  });

  it('still verifies entries signed with a rotated-out key', async () => {
    const store = new FakeAuditStore();
    const before = makeService({ hmac: ring({ v1: KEY_V1, v2: KEY_V2 }, 'v1') });
    await before.append(store.executor, {
      eventType: 'KEY_ROTATION',
      actor: { id: null, label: 'system' },
      message: 'signed with v1',
    });
    expect(store.toRow(0).key_id).toBe('v1');

    const after = makeService({ hmac: ring({ v1: KEY_V1, v2: KEY_V2 }, 'v2') });
    await after.append(store.executor, {
      eventType: 'AUTH_SUCCESS',
      actor: { id: null, label: 'system' },
      message: 'signed with v2',
    });
    expect(store.toRow(1).key_id).toBe('v2');

    const outcome = await after.verify(store.executor);
    expect(outcome.mismatches).toBe(0);
    expect(outcome.entries).toBe(2);
  });

  it('anchors a partial verification on the predecessor row', async () => {
    const { store, service } = await buildChain(5);
    const outcome = await service.verify(store.executor, { fromSeq: 3, toSeq: 5 });
    expect(outcome).toMatchObject({
      checkedFromSeq: 3,
      checkedToSeq: 5,
      entries: 3,
      mismatches: 0,
    });
  });

  it('never throws on a mismatch', async () => {
    const { store, service } = await buildChain();
    store.toRow(0).hash = 'f'.repeat(64);
    await expect(service.verify(store.executor)).resolves.toMatchObject({ mismatches: 2 });
  });
});

describe('pure verification helpers', () => {
  it('recomputes a hash from the row alone', async () => {
    const store = new FakeAuditStore();
    const service = makeService();
    const row = await service.append(store.executor, {
      eventType: 'AUTH_SUCCESS',
      actor: { id: null, label: 'system' },
      message: 'reproducible',
      createdAt: new Date('2026-09-24T09:41:12.000Z'),
    });
    const payload = entryPayload(row);
    expect(computeHash(row.prevHash, payload)).toBe(row.hash);
    expect(computeSignature(KEY_V1, row.hash)).toBe(row.signature);
    expect(checkEntry(row, ZERO_HASH, () => KEY_V1)).toBeNull();
    expect(checkEntry(row, 'a'.repeat(64), () => KEY_V1)?.reason).toBe('link');
  });
});

describe('audited() wrapper', () => {
  interface Harness {
    app: FastifyInstance;
    writes: string[];
    stats: { appends: number };
  }

  async function makeHarness(options: { appendThrows?: boolean } = {}): Promise<Harness> {
    const app = Fastify({ logger: false }) as FastifyInstance;
    const writes: string[] = [];
    const stats = { appends: 0 };
    const store = new FakeAuditStore();
    const service = makeService();

    const withTx = async (work: (tx: SqlExecutor) => Promise<unknown>): Promise<unknown> => {
      const marker = writes.length;
      const tx: SqlExecutor = {
        unsafe: async <T>(sql: string, params?: unknown[]): Promise<T> => {
          writes.push(sql);
          // Only audit statements reach the fake table; domain writes are recorded
          // so the rollback assertions can see them.
          if (sql.includes('audit_entries') || sql.includes('pg_advisory_xact_lock')) {
            return store.executor.unsafe<T>(sql, params);
          }
          return [] as T;
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        // Rollback: the domain write disappears, and so does any audit row.
        writes.length = marker;
        store.rows.length = 0;
        throw error;
      }
    };
    app.decorate('withTx', withTx as unknown as FastifyInstance['withTx']);

    const audit = {
      append: async (...args: Parameters<AuditService['append']>) => {
        stats.appends += 1;
        if (options.appendThrows === true) throw new Error('vault unreachable');
        return service.append(...args);
      },
      publish: async () => undefined,
    };
    app.decorate('audit', audit as unknown as FastifyInstance['audit']);
    app.decorateRequest('clientIp', '');
    app.decorateRequest('requestId', '');
    await app.register(errorHandler);

    return { app, writes, stats };
  }

  interface WriteResult {
    data: { id: string };
  }

  const writeSpec: AuditSpec<FastifyRequest, WriteResult> = {
    eventType: 'USER_PROVISIONED',
    subject: (_req, res) => res.data.id,
    message: (_req, res) => `Invitation issued to ${res.data.id}`,
    details: () => ({ checklist: { ndaOnFile: true } }),
  };

  const writeHandler = async (
    _req: FastifyRequest,
    _reply: FastifyReply,
    ctx: { tx: Tx },
  ): Promise<WriteResult> => {
    await asExecutor(ctx.tx).unsafe('insert into staff_invitations values (1)');
    return { data: { id: 'a.mohamed@vunvault.com' } };
  };

  it('tags the handler so a route-table test can prove coverage', () => {
    const handler = audited(writeSpec, writeHandler);
    expect(isAudited(handler)).toBe(true);
    expect(isAudited(async () => undefined)).toBe(false);
    expect(isAudited('not a function')).toBe(false);
  });

  it('writes the domain change and the audit entry in one transaction', async () => {
    const harness = await makeHarness();
    harness.app.get('/__test/write', audited(writeSpec, writeHandler));

    const response = await harness.app.inject({ method: 'GET', url: '/__test/write' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { id: 'a.mohamed@vunvault.com' } });
    expect(harness.writes).toContain('insert into staff_invitations values (1)');
    expect(harness.stats.appends).toBe(1);
    await harness.app.close();
  });

  it('rolls the domain write back when the audit append fails', async () => {
    const harness = await makeHarness({ appendThrows: true });
    harness.app.get('/__test/write', audited(writeSpec, writeHandler));

    const response = await harness.app.inject({ method: 'GET', url: '/__test/write' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'audit_unavailable' });
    // The domain write is gone: a mutation that cannot be recorded does not happen.
    expect(harness.writes).toHaveLength(0);
    await harness.app.close();
  });

  it('writes nothing when the handler throws', async () => {
    const harness = await makeHarness();
    harness.app.get(
      '/__test/fails',
      audited(writeSpec, async (_req, _reply, ctx) => {
        await asExecutor(ctx.tx).unsafe('insert into staff_invitations values (1)');
        throw HttpError.notFound('No such member');
      }),
    );

    const response = await harness.app.inject({ method: 'GET', url: '/__test/fails' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
    expect(harness.writes).toHaveLength(0);
    expect(harness.stats.appends).toBe(0);
    await harness.app.close();
  });

  it('derives the actor from the authenticated user and labels them by local-part', () => {
    expect(actorLabelFor('e.reed@vunvault.com')).toBe('e.reed');
    expect(actorLabelFor('no-at-sign')).toBe('no-at-sign');
    expect(defaultActor({} as FastifyRequest)).toEqual({ id: null, label: 'external' });
    expect(
      defaultActor({
        user: { id: 'u1', email: 'e.reed@vunvault.com' },
      } as unknown as FastifyRequest),
    ).toEqual({ id: 'u1', label: 'e.reed' });
  });

  it('builds the append input from the spec', () => {
    const input = buildAuditInput(
      {
        eventType: 'REPORT_RELEASED',
        subject: (_req, res) => res.jobCode,
        message: (_req, res) => `Released ${res.jobCode}`,
        details: () => ({ gate: 'approved' }),
      },
      {
        user: { id: 'u1', email: 'f.hassan@vunvault.com' },
        clientIp: '',
        ip: '10.0.0.1',
      } as unknown as FastifyRequest,
      { jobCode: 'JOB-4471' },
    );
    expect(input).toMatchObject({
      eventType: 'REPORT_RELEASED',
      subject: 'JOB-4471',
      message: 'Released JOB-4471',
      actor: { id: 'u1', label: 'f.hassan' },
      details: { gate: 'approved' },
      ip: '10.0.0.1',
    });
  });
});

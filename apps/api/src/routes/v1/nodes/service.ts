import { createPublicKey, verify as verifySignature, type KeyObject } from 'node:crypto';
import type { NodeHeartbeatBody } from '@vunvault/contracts';
import type { NodeStatus } from '@vunvault/db/enum-values';
import { HttpError } from '../../../lib/http-error.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';

/**
 * Sensor-node heartbeats (Task 37).
 *
 * A sensor node sits in a client's network and reports load and clock drift. It
 * has no session and no cookie — it authenticates every heartbeat with an Ed25519
 * signature over a canonical string, verified against the public key registered
 * for that node. An attacker who can reach this endpoint but cannot sign for the
 * node gets `401 bad_signature`, and gets it without the API revealing whether the
 * node code exists.
 *
 * The only table this writes is `sensor_nodes`. Heartbeat MISSES are counted by the
 * maintenance worker (Layer L11): 2 misses → `degraded`, 3 → `offline`. A node that
 * stops talking cannot demote itself, and this endpoint must not pretend otherwise.
 */

/** A heartbeat more than this far from server time is refused. */
export const HEARTBEAT_MAX_SKEW_MS = 30_000;

/** Above this load the autoscaler should add capacity. */
export const HIGH_LOAD_THRESHOLD_PERCENT = 85;

/** Milliseconds of clock drift worth warning about. */
export const DRIFT_WARNING_THRESHOLD_MS = 15;

/** Six heartbeats a minute per node is generous; more is a runaway agent. */
export const HEARTBEAT_RATE_LIMIT = 6;
export const HEARTBEAT_RATE_WINDOW_SECONDS = 60;

export function rateLimitKeyFor(nodeCode: string): string {
  return `nodehb:${nodeCode}`;
}

/** The exact bytes a node signs. Field order is part of the contract. */
export function canonicalHeartbeatString(body: {
  nodeCode: string;
  sentAt: string;
  reqPerMin: number;
  loadPercent: number;
  clockDriftMs: number;
}): string {
  return `${body.nodeCode}|${body.sentAt}|${body.reqPerMin}|${body.loadPercent}|${body.clockDriftMs}`;
}

/** The DER prefix that turns a raw 32-byte Ed25519 key into a SPKI blob. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Accept a PEM, a base64 raw key, or a base64 SPKI blob: nodes are provisioned by
 * hand, and refusing a valid key format would strand a sensor in the field.
 */
export function publicKeyFromStored(stored: string): KeyObject {
  const trimmed = stored.trim();
  if (trimmed.startsWith('-----')) return createPublicKey(trimmed);
  const raw = Buffer.from(trimmed, 'base64');
  if (raw.length === 32) {
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
      format: 'der',
      type: 'spki',
    });
  }
  return createPublicKey({ key: raw, format: 'der', type: 'spki' });
}

/** Never throws: a malformed key is simply a failed verification. */
export function verifyHeartbeatSignature(
  storedPublicKey: string,
  canonical: string,
  signatureBase64: string,
): boolean {
  try {
    const key = publicKeyFromStored(storedPublicKey);
    const signature = Buffer.from(signatureBase64, 'base64');
    if (signature.length === 0) return false;
    return verifySignature(null, Buffer.from(canonical, 'utf8'), key, signature);
  } catch {
    return false;
  }
}

/** Drift wins over load: a lying clock makes every other number suspect. */
export function deriveStatus(loadPercent: number, clockDriftMs: number): NodeStatus {
  if (Math.abs(clockDriftMs) > DRIFT_WARNING_THRESHOLD_MS) return 'drift_warning';
  if (loadPercent > HIGH_LOAD_THRESHOLD_PERCENT) return 'high_load';
  return 'operational';
}

export interface SensorNodeRow {
  id: string;
  code: string;
  publicKey: string;
  status: string;
  missedHeartbeats: number;
}

export interface HeartbeatWrite {
  reqPerMin: number;
  loadPercent: number;
  clockDriftMs: number;
  heartbeatLatencyMs: number;
  status: NodeStatus;
  receivedAt: Date;
}

export interface NodesRepo {
  findByCode(nodeCode: string): Promise<SensorNodeRow | null>;
  recordHeartbeat(nodeId: string, write: HeartbeatWrite): Promise<void>;
}

export class SqlNodesRepo implements NodesRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async findByCode(nodeCode: string): Promise<SensorNodeRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        code: string;
        public_key: string;
        status: string;
        missed_heartbeats: number;
      }>
    >(
      `select id::text as id, code, public_key, status::text as status, missed_heartbeats
         from sensor_nodes
        where code = $1
        limit 1`,
      [nodeCode],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      code: row.code,
      publicKey: row.public_key,
      status: row.status,
      missedHeartbeats: Number(row.missed_heartbeats),
    };
  }

  async recordHeartbeat(nodeId: string, write: HeartbeatWrite): Promise<void> {
    await this.executor.unsafe(
      `update sensor_nodes
          set req_per_min = $2,
              load_percent = $3,
              clock_drift_ms = $4,
              heartbeat_latency_ms = $5,
              status = $6::node_status,
              last_heartbeat_at = $7,
              missed_heartbeats = 0,
              updated_at = now()
        where id = $1::uuid`,
      [
        nodeId,
        write.reqPerMin,
        write.loadPercent,
        write.clockDriftMs,
        write.heartbeatLatencyMs,
        write.status,
        write.receivedAt,
      ],
    );
  }
}

/** A per-node counter: Redis in production, a Map in tests. */
export interface RateCounter {
  /** Returns the count AFTER this call, resetting the window on the first hit. */
  increment(key: string, windowSeconds: number): Promise<number>;
}

export class MemoryRateCounter implements RateCounter {
  private readonly hits = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const existing = this.hits.get(key);
    if (existing === undefined || existing.expiresAt <= this.now()) {
      this.hits.set(key, { count: 1, expiresAt: this.now() + windowSeconds * 1000 });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}

export interface NodesServiceDeps {
  repo: NodesRepo;
  counter?: RateCounter;
  now?: () => Date;
  log?: { warn: (message: string, error?: unknown) => void };
}

export class NodesService {
  private readonly repo: NodesRepo;
  private readonly counter: RateCounter | undefined;
  private readonly now: () => Date;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(deps: NodesServiceDeps) {
    this.repo = deps.repo;
    this.counter = deps.counter;
    this.now = deps.now ?? (() => new Date());
    this.warn = deps.log?.warn.bind(deps.log) ?? ((): undefined => undefined);
  }

  /**
   * Verify, then record. Verification happens before the rate counter is
   * consulted for an unknown node, so this endpoint cannot be used to enumerate
   * node codes at six requests a minute each.
   */
  async heartbeat(body: NodeHeartbeatBody): Promise<void> {
    const receivedAt = this.now();

    const node = await this.repo.findByCode(body.nodeCode);
    if (node === null) {
      // Same answer as a bad signature: whether a node code exists is not public.
      throw badSignature();
    }

    const canonical = canonicalHeartbeatString(body);
    if (!verifyHeartbeatSignature(node.publicKey, canonical, body.signature)) {
      this.warn(`heartbeat signature rejected for node ${body.nodeCode}`);
      throw badSignature();
    }

    const skewMs = Math.abs(receivedAt.getTime() - new Date(body.sentAt).getTime());
    if (!Number.isFinite(skewMs) || skewMs > HEARTBEAT_MAX_SKEW_MS) {
      throw new HttpError(401, 'stale', 'That heartbeat is too old to accept');
    }

    if (this.counter !== undefined) {
      const hits = await this.counter.increment(
        rateLimitKeyFor(body.nodeCode),
        HEARTBEAT_RATE_WINDOW_SECONDS,
      );
      if (hits > HEARTBEAT_RATE_LIMIT) {
        throw HttpError.tooManyRequests('Too many heartbeats from this node');
      }
    }

    await this.repo.recordHeartbeat(node.id, {
      reqPerMin: body.reqPerMin,
      loadPercent: body.loadPercent,
      clockDriftMs: body.clockDriftMs,
      // A node whose clock is ahead would report a negative latency; zero is the
      // honest floor for a measurement we cannot make more precise than this.
      heartbeatLatencyMs: Math.max(0, receivedAt.getTime() - new Date(body.sentAt).getTime()),
      status: deriveStatus(body.loadPercent, body.clockDriftMs),
      receivedAt,
    });
  }
}

function badSignature(): HttpError {
  return new HttpError(401, 'bad_signature', 'The heartbeat signature did not verify');
}

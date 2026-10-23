import type { Permission, ScanControlType, ScanStreamStatus, UserRole } from '@vunvault/contracts';
import type { AuditService } from '../../../audit/service';
import { asExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import type { Tx } from '../../../plugins/db';
import type { ScansRepo } from '../scans/repo';
import { controlChannel } from './channels';

/**
 * Scan stream authorisation and control (Task 95).
 *
 * Two jobs, both small on purpose:
 *
 *  1. `targetFor` is the handshake's 404/derivation step: load the job for a
 *     staff viewer and map the DB status onto the four wire statuses. Staff
 *     with `scans:read` may watch ANY job — the release lock protects the
 *     CLIENT portal (route-level `requireStaff` is what keeps clients out);
 *     an analyst watching a live scan of their own queue is the product.
 *  2. `sendControl` is the only path from a browser to a scan node: the audit
 *     entry is appended in a transaction FIRST, and the Redis publish happens
 *     only after that transaction commits. If the audit cannot be written, the
 *     control does not go out — an unrecorded hand on a running scan is
 *     exactly what the chain exists to prevent.
 */

/** Roles allowed to `kill` (destroy the node), beyond the permission check. */
const KILL_ROLES: ReadonlySet<UserRole> = new Set(['admin', 'super_admin']);

/** One definition, owned by the session module (it stays contracts-only). */
import type { ScanStreamTarget } from './session';

export type { ScanStreamTarget };

/** DB status → the wire's four. Unknown values fail closed to `failed`. */
export function streamStatusOf(dbStatus: string): ScanStreamStatus {
  switch (dbStatus) {
    case 'queued':
    case 'running':
      return 'running';
    case 'awaiting_review':
    case 'completed':
      return 'completed';
    case 'held':
    case 'rejected':
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'failed';
  }
}

/** Wire statuses after which no more output will ever arrive. */
export const TERMINAL_STREAM_STATUSES: ReadonlySet<ScanStreamStatus> = new Set([
  'completed',
  'cancelled',
  'failed',
]);

export interface ScanStreamActor {
  id: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
}

export interface ScanStreamServiceDeps {
  repo: Pick<ScansRepo, 'getJobById'>;
  audit: Pick<AuditService, 'append'>;
  withTx: (work: (tx: Tx) => Promise<void>) => Promise<void>;
  /** The shared command connection's `publish`. */
  publish: (channel: string, payload: string) => Promise<unknown>;
}

export class ScanStreamService {
  constructor(private readonly deps: ScanStreamServiceDeps) {}

  /** The handshake load: a job that does not exist does not exist for anyone. */
  async targetFor(jobId: string): Promise<ScanStreamTarget> {
    const row = await this.deps.repo.getJobById(jobId);
    if (row === null) throw HttpError.notFound();
    const status = streamStatusOf(row.status);
    return {
      jobId: row.id,
      jobCode: row.jobCode,
      dbStatus: row.status,
      status,
      terminal: TERMINAL_STREAM_STATUSES.has(status),
    };
  }

  static canExecute(actor: ScanStreamActor): boolean {
    return actor.permissions.includes('scans:execute');
  }

  static canKill(actor: ScanStreamActor): boolean {
    return KILL_ROLES.has(actor.role);
  }

  /**
   * Audit-then-publish one control signal. Resolves once the controller has
   * been told; throws when either the audit transaction or the publish fails
   * (the session logs and sends no ack — silence, never a false receipt).
   */
  async sendControl(input: {
    actor: ScanStreamActor;
    target: ScanStreamTarget;
    type: ScanControlType;
    ip: string;
  }): Promise<void> {
    const { actor, target, type, ip } = input;
    await this.deps.withTx(async (tx) => {
      await this.deps.audit.append(asExecutor(tx), {
        eventType: 'SCAN_CONTROL_SENT',
        actor: { id: actor.id, label: actor.email },
        subject: target.jobId,
        message: `${type} sent to ${target.jobCode} by ${actor.email}`,
        details: { jobId: target.jobId, type },
        ip,
      });
    });
    // Committed: the fact is in the chain, so the signal may go out.
    await this.deps.publish(controlChannel(target.jobId), JSON.stringify({ type }));
  }
}

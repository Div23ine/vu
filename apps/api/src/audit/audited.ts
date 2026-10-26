import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../lib/http-error.js';
import type { Tx } from '../plugins/db.js';
import type { AuditEventType } from './events.js';
import { asExecutor } from './repo.js';
import { toView, type AuditAppendInput, type AuditEntryView } from './service.js';

/**
 * The `audited()` route wrapper.
 *
 * Every state-changing route runs its domain write and its audit append inside ONE
 * transaction: if the write fails, nothing is recorded; if the record cannot be
 * written, the write is rolled back and the request fails. A mutation that cannot
 * be accounted for does not happen.
 *
 * The returned handler is tagged with `Symbol.for("vv.audited")` so Task 40's
 * route-table test can prove that no mutating route escaped the wrapper.
 */

export const AUDITED = Symbol.for('vv.audited');

export interface AuditSpec<Req, Res> {
  eventType: AuditEventType;
  subject?: (req: Req, res: Res) => string | undefined;
  message: (req: Req, res: Res) => string;
  details?: (req: Req, res: Res) => Record<string, unknown>;
  sealed?: (req: Req, res: Res) => Record<string, unknown>;
  actor?: (req: Req) => { id: string | null; label: string };
}

export type AuditedHandler<Req, Res> = (
  req: Req,
  reply: FastifyReply,
  ctx: { tx: Tx },
) => Promise<Res>;

export type AuditedRouteHandler<Req, Res> = (req: Req, reply: FastifyReply) => Promise<Res>;

/** `e.reed@vunvault.com` → `e.reed`; an anonymous caller is `external`. */
export function actorLabelFor(email: string): string {
  const at = email.indexOf('@');
  return at === -1 ? email : email.slice(0, at);
}

export function defaultActor(request: FastifyRequest): { id: string | null; label: string } {
  const user = request.user;
  if (user === undefined) return { id: null, label: 'external' };
  return { id: user.id, label: actorLabelFor(user.email) };
}

export function buildAuditInput<Req extends FastifyRequest, Res>(
  spec: AuditSpec<Req, Res>,
  request: Req,
  result: Res,
): AuditAppendInput {
  const actor = spec.actor === undefined ? defaultActor(request) : spec.actor(request);
  return {
    eventType: spec.eventType,
    actor,
    subject: spec.subject?.(request, result),
    message: spec.message(request, result),
    details: spec.details?.(request, result),
    sealed: spec.sealed?.(request, result),
    ip: request.clientIp === '' ? request.ip : request.clientIp,
  };
}

export function isAudited(handler: unknown): boolean {
  if (typeof handler !== 'function') return false;
  return (handler as unknown as Record<symbol, unknown>)[AUDITED] === true;
}

export function audited<Req extends FastifyRequest, Res>(
  spec: AuditSpec<Req, Res>,
  handler: AuditedHandler<Req, Res>,
): AuditedRouteHandler<Req, Res> {
  const wrapped = async (request: Req, reply: FastifyReply): Promise<Res> => {
    const app = request.server as FastifyInstance;
    let view: AuditEntryView | undefined;
    let auditFailureError: unknown;

    try {
      const result = await app.withTx(async (tx) => {
        const executor = asExecutor(tx);
        const outcome = await handler(request, reply, { tx });
        try {
          const row = await app.audit.append(executor, buildAuditInput(spec, request, outcome));
          view = toView(row);
        } catch (error) {
          // CHANGED: log the *real* failure before rolling back. Without this,
          // every audit-append bug surfaces as a generic 500 "audit_unavailable"
          // and the actual cause is invisible.
          app.log.error(
            { err: error, requestId: request.id, eventType: spec.eventType },
            'audit append failed; rolling back the domain write',
          );
          // Rolling back the domain write is the point: no write without a record.
          auditFailureError = error;
          throw error;
        }
        return outcome;
      });

      // Committed: the live stream may now see the entry.
      if (view !== undefined) await app.audit.publish(view);
      return result;
    } catch (error) {
      if (auditFailureError !== undefined) {
        throw new HttpError(500, 'audit_unavailable', 'The audit log is unavailable');
      }
      throw error;
    }
  };

  (wrapped as unknown as Record<symbol, boolean>)[AUDITED] = true;
  return wrapped;
}

export interface AuditFailureSpec {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
}

/**
 * Record a REJECTED attempt (a failed login, a release-lock violation) in its own
 * short transaction. This is the only append path that is not wrapped around a
 * domain write, because there is no domain write: the attempt was refused.
 *
 * It never throws — an audit failure here must not mask the original refusal.
 */
export async function auditFailure(
  app: FastifyInstance,
  spec: AuditFailureSpec,
  request: FastifyRequest,
  error?: unknown,
): Promise<void> {
  try {
    await app.withTx(async (tx) => {
      await app.audit.append(asExecutor(tx), {
        eventType: spec.eventType,
        actor: defaultActor(request),
        subject: spec.subject,
        message: spec.message,
        details: {
          ...spec.details,
          ...(error === undefined
            ? {}
            : { reason: error instanceof Error ? error.message : String(error) }),
        },
        ip: request.clientIp === '' ? request.ip : request.clientIp,
      });
    });
  } catch (err) {
    // CHANGED: include the error so audit failures on rejected attempts are
    // also visible in the log rather than swallowed.
    app.log.error(
      { err, requestId: request.id, eventType: spec.eventType },
      'could not record a rejected attempt',
    );
  }
}

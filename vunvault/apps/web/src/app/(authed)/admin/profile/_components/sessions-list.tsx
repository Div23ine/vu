'use client';

import { LogOut, MonitorSmartphone, ShieldOff } from 'lucide-react';
import type { SessionView } from '@vunvault/contracts';
import { formatQueueStamp, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import {
  useAccountSessions,
  useRevokeOtherSessions,
  useRevokeSession,
} from '../_hooks/use-admin-security';

/**
 * Active sessions (Task 83d) — the administrator's own device list.
 *
 * Every column is the API's `SessionView`: device label, IP, rendered location,
 * the MFA method that authenticated it, the start stamp and the `This device`
 * chip on the row whose `current` flag is set. Revoking one row and revoking
 * every other row are separate endpoints, and the bulk action reports the count
 * the API actually revoked rather than the count the UI hoped for.
 *
 * AUTHORED copy (documented): `MFA_METHOD_LABELS` has no contract record, and
 * the revoke toasts are not quoted in the spec, so these four strings are
 * factual rather than verbatim. The `Sessions revoked` title IS the spec's.
 */

const MFA_METHOD_LABELS: Record<NonNullable<SessionView['mfaMethod']>, string> = {
  totp: 'Authenticator app',
  webauthn: 'Hardware key',
  email_otp: 'Email code',
};

export function SessionsList() {
  const sessions = useAccountSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const rows = sessions.data ?? [];
  const others = rows.filter((session) => !session.current).length;

  const onRevoke = (session: SessionView): void => {
    revoke.mutate(session.id, {
      onSuccess: () =>
        toast({
          kind: 'ok',
          title: 'Session revoked',
          message: `${session.deviceLabel} was signed out.`,
        }),
      onError: (error) =>
        toast({
          kind: 'crit',
          title: 'Could not revoke session',
          message: isApiError(error) ? error.message : 'Please try again.',
        }),
    });
  };

  const onRevokeOthers = (): void => {
    revokeOthers.mutate(undefined, {
      onSuccess: (revoked) =>
        toast({
          kind: 'ok',
          title: 'Sessions revoked',
          message: `${revoked} other session(s) were signed out.`,
        }),
      onError: (error) =>
        toast({
          kind: 'crit',
          title: 'Could not revoke sessions',
          message: isApiError(error) ? error.message : 'Please try again.',
        }),
    });
  };

  return (
    <div className="ps-sessions">
      <div className="ps-sessions-head">
        <span className="ps-panel-label">
          <MonitorSmartphone size={13} aria-hidden="true" />
          Active Sessions
        </span>
        <button
          type="button"
          className="adm-mini-btn"
          disabled={others === 0 || revokeOthers.isPending}
          onClick={onRevokeOthers}
        >
          <LogOut size={13} aria-hidden="true" />
          Sign out all other sessions
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="ps-note">No active sessions.</p>
      ) : (
        <ul className="ps-session-list">
          {rows.map((session) => (
            <li className="ps-session" key={session.id}>
              <span className="ps-session-body">
                <span className="ps-session-device">
                  {session.deviceLabel}
                  {session.current ? <span className="ps-session-chip">This device</span> : null}
                </span>
                <span className="ps-session-meta">
                  {session.ip ?? '—'}
                  {session.location === null ? '' : ` · ${session.location}`}
                  {session.mfaMethod === null
                    ? ''
                    : ` · ${MFA_METHOD_LABELS[session.mfaMethod]}`}
                </span>
                <span className="ps-session-meta">
                  Started {formatQueueStamp(new Date(session.startedAt))}
                </span>
              </span>
              <button
                type="button"
                className="ps-session-revoke"
                disabled={session.current || revoke.isPending}
                title={
                  session.current
                    ? 'The session you are using cannot be revoked.'
                    : undefined
                }
                onClick={() => onRevoke(session)}
              >
                <ShieldOff size={13} aria-hidden="true" />
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

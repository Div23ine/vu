'use client';

import { Mail, MailWarning } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS } from '@vunvault/contracts';
import { formatLongDate, isApiError, queryKeys } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { apiDelete, apiPost } from '../../../../../lib/api';
import { can } from '../../../../../lib/permissions';
import { useSession } from '../../../../../lib/session';
import { useStaffRoster } from '../_hooks/use-users';
import '../_styles/users.css';

/**
 * Pending invitations panel (replaces the an earlier iteration stub).
 *
 * The list is the roster's `status=pending_invite` slice (the data section's
 * source): name, email, role label and the expiry line derived from the
 * verbatim 72-hour rule (`Invitations expire after 72 hours if MFA enrolment
 * is not completed.`). `Resend` / `Revoke` need `users:manage` and hit the
 * invitation endpoints; `All invitations` is the informational workspace
 * link. The mutations live here because `use-users.ts` is a an earlier iteration file.
 */

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export function InvitationsPanel() {
  const { user } = useSession();
  const canManage = can(user, 'users:manage');
  const queryClient = useQueryClient();

  const roster = useStaffRoster({
    q: '',
    role: '',
    status: 'pending_invite',
    mfa: '',
    page: 1,
    pageSize: 50,
  });

  const resend = useMutation({
    // TODO(backend-contract): POST /api/v1/admin/users/invitations/:id/resend
    //  → 200 { data: Invitation } | 409 resend_limit
    mutationFn: (id: string) => apiPost<unknown>(`/api/v1/admin/users/invitations/${id}/resend`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });

  const revoke = useMutation({
    // TODO(backend-contract): DELETE /api/v1/admin/users/invitations/:id → 204
    mutationFn: (id: string) => apiDelete<void>(`/api/v1/admin/users/invitations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });

  const invites = roster.data?.data ?? [];

  return (
    <section className="adm-card" aria-labelledby="um-invites-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="um-invites-heading">
            <Mail size={17} aria-hidden="true" />
            Pending Invitations
          </h2>
          <p className="adm-card-note">Awaiting acceptance and MFA enrolment.</p>
        </div>
        <span className="adm-tag adm-tag--warn">{invites.length}</span>
      </div>
      <div className="adm-card-body">
        {invites.length === 0 ? (
          <p className="um-invites-empty">No pending invitations.</p>
        ) : (
          <div className="um-invites">
            {invites.map((member) => (
              <article className="um-invite" key={member.id}>
                <div className="um-invite-top">
                  <span className="um-invite-name">{member.fullName}</span>
                  <span className="um-role">{ROLE_LABELS[member.role]}</span>
                </div>
                <span className="um-invite-email">{member.email}</span>
                <span className="um-invite-meta">
                  expires{' '}
                  {formatLongDate(new Date(new Date(member.joinedAt).getTime() + INVITE_TTL_MS))}
                </span>
                {canManage ? (
                  <span className="um-invite-actions">
                    <button
                      type="button"
                      className="um-act"
                      disabled={resend.isPending}
                      onClick={() =>
                        resend.mutate(member.id, {
                          onSuccess: () => {
                            toast({
                              kind: 'ok',
                              title: 'Invitation resent',
                              message: `${member.email} — secure invitation email re-dispatched.`,
                            });
                          },
                          onError: (error) => {
                            if (
                              isApiError(error) &&
                              error.status === 409 &&
                              error.code === 'resend_limit'
                            ) {
                              toast({
                                kind: 'warn',
                                title: 'Resend limit reached. Revoke and invite again.',
                              });
                              return;
                            }
                            toast({
                              kind: 'crit',
                              title: 'Could not resend the invitation',
                              message: 'Please try again.',
                            });
                          },
                        })
                      }
                    >
                      <MailWarning size={13} aria-hidden="true" />
                      Resend
                    </button>
                    <button
                      type="button"
                      className="um-act um-act--danger"
                      disabled={revoke.isPending}
                      onClick={() =>
                        revoke.mutate(member.id, {
                          onSuccess: () => {
                            toast({
                              kind: 'info',
                              title: 'Invitation revoked',
                              message: `${member.email} — pending invitation invalidated.`,
                            });
                          },
                          onError: () => {
                            toast({
                              kind: 'crit',
                              title: 'Could not revoke the invitation',
                              message: 'Please try again.',
                            });
                          },
                        })
                      }
                    >
                      Revoke
                    </button>
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        )}
        <button
          type="button"
          className="um-invites-all"
          onClick={() => {
            toast({
              kind: 'info',
              title: 'All invitations',
              message: `Opening the full invitation workspace — ${invites.length} pending.`,
            });
          }}
        >
          All invitations
        </button>
      </div>
    </section>
  );
}

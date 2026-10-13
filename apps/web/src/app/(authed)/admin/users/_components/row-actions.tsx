'use client';

import { useState } from 'react';
import { PencilLine, ShieldCheck } from 'lucide-react';
import type { StaffMember, UserRole } from '@vunvault/contracts';
import { ROLE_LABELS } from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import {
  useChangeRole,
  useDeleteMember,
  useEnforceMfa,
  useReactivateMember,
  useSuspendMember,
} from '../_hooks/use-users';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { PermissionDialog } from './permission-dialog';
import '../_styles/users.css';

/**
 * Roster row actions (Task 79) — the `users:manage` menu: Permissions (the
 * Task 80 dialog seam), the profile-editor toast (no endpoint yet), and the
 * state-dependent writes — Suspend (confirm + optional reason), Reactivate,
 * Enforce MFA (un-enrolled actives), Change role (select + confirm) and the
 * destructive Delete (suspended only). Without `users:manage` the roster is
 * read-only: nothing renders. The API's `self_action` / `last_super_admin`
 * 409s map to the verbatim crit toast.
 */

const STAFF_ROLE_VALUES = [
  'super_admin',
  'admin',
  'security_analyst',
  'soc_operator',
  'compliance_auditor',
  'support_engineer',
] as const;

const NOT_ALLOWED = {
  kind: 'crit',
  title: 'Action not allowed',
  message: 'You cannot do this to your own account or the last Super Administrator.',
} as const;

/** Shared 409 mapping for the row writes. Returns true when handled. */
function isNotAllowedError(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.status === 409 &&
    (error.code === 'self_action' || error.code === 'last_super_admin')
  );
}

interface RowActionsProps {
  member: StaffMember;
  canManage: boolean;
}

type ConfirmState = 'suspend' | 'delete' | 'role' | null;

export function RowActions({ member, canManage }: RowActionsProps) {
  const suspend = useSuspendMember();
  const reactivate = useReactivateMember();
  const enforceMfa = useEnforceMfa();
  const changeRole = useChangeRole();
  const deleteMember = useDeleteMember();
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState<UserRole>(member.role);

  if (!canManage) return null;

  const onError = (error: unknown): void => {
    if (isNotAllowedError(error)) {
      toast(NOT_ALLOWED);
      return;
    }
    toast({ kind: 'crit', title: 'Action failed', message: 'Please try again.' });
  };

  const editProfile = (): void => {
    // TODO(backend-contract): no profile-editor endpoint exists yet.
    toast({
      kind: 'info',
      title: 'Profile editor',
      message: `${member.fullName} — editing name, title, team and scope assignment.`,
    });
  };

  const doSuspend = (reason?: string): void => {
    setConfirmState(null);
    suspend.mutate(
      { id: member.id, body: reason === undefined ? {} : { reason } },
      {
        onSuccess: () => {
          toast({
            kind: 'ok',
            title: 'Account suspended',
            message: `${member.email} — all active session tokens revoked immediately.`,
          });
        },
        onError,
      },
    );
  };

  const doReactivate = (): void => {
    reactivate.mutate(
      { id: member.id },
      {
        onSuccess: () => {
          toast({
            kind: 'ok',
            title: 'Account reactivated',
            message: `${member.email} — new invitation issued for MFA re-enrolment.`,
          });
        },
        onError,
      },
    );
  };

  const doEnforceMfa = (): void => {
    enforceMfa.mutate(
      { id: member.id },
      {
        onSuccess: () => {
          toast({
            kind: 'ok',
            title: 'MFA enforcement',
            message: `${member.email} — enrolment challenge re-issued with 24-hour deadline.`,
          });
        },
        onError,
      },
    );
  };

  const doChangeRole = (): void => {
    setConfirmState(null);
    changeRole.mutate(
      { id: member.id, body: { role: roleDraft } },
      {
        onSuccess: () => {
          toast({
            kind: 'ok',
            title: 'Role updated',
            message: `${member.email} is now ${ROLE_LABELS[roleDraft]}.`,
          });
        },
        onError,
      },
    );
  };

  const doDelete = (): void => {
    setConfirmState(null);
    deleteMember.mutate(
      { id: member.id },
      {
        onSuccess: () => {
          toast({
            kind: 'ok',
            title: 'Account deletion queued',
            message: `${member.email} — permanent removal scheduled after 30-day retention window.`,
          });
        },
        onError,
      },
    );
  };

  const suspendable = member.accountStatus === 'active' || member.accountStatus === 'dormant';
  const suspended = member.accountStatus === 'suspended';
  const needsMfa = !member.mfa.enrolled && member.accountStatus === 'active';
  const manageable = member.accountStatus === 'active' || member.accountStatus === 'dormant';

  return (
    <span className="um-actions">
      {manageable ? (
        <button
          type="button"
          className="um-act um-act--primary"
          onClick={() => setPermissionsOpen(true)}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          Permissions
        </button>
      ) : null}

      <button
        type="button"
        className="um-icon-btn"
        aria-label={`Edit profile for ${member.fullName}`}
        onClick={editProfile}
      >
        <PencilLine size={14} aria-hidden="true" />
      </button>

      {needsMfa ? (
        <button
          type="button"
          className="um-act"
          disabled={enforceMfa.isPending}
          onClick={doEnforceMfa}
        >
          Enforce MFA
        </button>
      ) : null}

      {suspendable ? (
        <button
          type="button"
          className="um-act"
          disabled={suspend.isPending}
          onClick={() => setConfirmState('suspend')}
        >
          Suspend
        </button>
      ) : null}

      {suspended ? (
        <>
          <button
            type="button"
            className="um-act"
            disabled={reactivate.isPending}
            onClick={doReactivate}
          >
            Reactivate
          </button>
          <button
            type="button"
            className="um-act um-act--danger"
            disabled={deleteMember.isPending}
            onClick={() => setConfirmState('delete')}
          >
            Delete
          </button>
        </>
      ) : null}

      {manageable ? (
        <button
          type="button"
          className="um-act"
          onClick={() => {
            setRoleDraft(member.role);
            setConfirmState('role');
          }}
        >
          Change role
        </button>
      ) : null}

      <PermissionDialog member={member} open={permissionsOpen} onOpenChange={setPermissionsOpen} />

      <ConfirmActionDialog
        open={confirmState === 'suspend'}
        onOpenChange={(open) => setConfirmState(open ? 'suspend' : null)}
        title={`Suspend ${member.fullName}?`}
        description="Every active session token is revoked immediately. The account keeps its history and can be reactivated."
        confirmLabel="Suspend account"
        reasonLabel="Reason (optional — recorded in the audit log)"
        pending={suspend.isPending}
        onConfirm={doSuspend}
      />

      <ConfirmActionDialog
        open={confirmState === 'role'}
        onOpenChange={(open) => setConfirmState(open ? 'role' : null)}
        title={`Change role for ${member.fullName}?`}
        description="The new role takes effect on the member's next request. The change is written to the immutable audit log."
        confirmLabel="Change role"
        pending={changeRole.isPending}
        onConfirm={doChangeRole}
      >
        <div className="um-field">
          <label className="um-field-label" htmlFor="um-role-draft">
            New role
          </label>
          <select
            id="um-role-draft"
            className="um-select"
            value={roleDraft}
            onChange={(event) => setRoleDraft(event.target.value as UserRole)}
          >
            {STAFF_ROLE_VALUES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={confirmState === 'delete'}
        onOpenChange={(open) => setConfirmState(open ? 'delete' : null)}
        title={`Delete ${member.fullName}?`}
        description="Permanent removal is scheduled after the 30-day retention window. This cannot be undone."
        confirmLabel="Delete account"
        destructive
        pending={deleteMember.isPending}
        onConfirm={doDelete}
      />
    </span>
  );
}

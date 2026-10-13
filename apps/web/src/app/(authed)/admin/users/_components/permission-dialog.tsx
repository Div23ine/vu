'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { StaffMember, StaffRole, UserRole } from '@vunvault/contracts';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import { useSession } from '../../../../../lib/session';
import { useChangeRole } from '../_hooks/use-users';
import '../_styles/users.css';

/**
 * Permission dialog (Task 80) — opened from the roster's `Permissions`
 * action.
 *
 * TODO(backend-contract): per-capability overrides are not supported; role
 * changes only. The API has NO per-user override endpoint — the role is the
 * only authority — so the prototype's capability checkboxes are implemented
 * as a role select plus the resulting permission DIFF (added/removed
 * capabilities computed from `ROLE_PERMISSIONS`), the verbatim
 * authorisation requirement and the `Permissions updated` toast; Save calls
 * `PATCH /admin/users/:id/role`.
 */

// TODO(backend-contract): per-capability overrides are not supported; role changes only

const ROLE_OPTIONS: StaffRole[] = [
  'super_admin',
  'admin',
  'security_analyst',
  'soc_operator',
  'compliance_auditor',
  'support_engineer',
];

const AUTHORISATION_TEXT = 'Confirm that this access change is authorised before saving.';

interface PermissionDialogProps {
  member: StaffMember | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function PermissionDialog({ member, open, onOpenChange }: PermissionDialogProps) {
  const { user } = useSession();
  const changeRole = useChangeRole();
  const isSuperAdmin = user?.role === 'super_admin';

  const [role, setRole] = useState<UserRole | ''>('');
  const [authorised, setAuthorised] = useState(false);
  const [authorisationTouched, setAuthorisationTouched] = useState(false);

  useEffect(() => {
    if (open && member !== null) {
      setRole('');
      setAuthorised(false);
      setAuthorisationTouched(false);
    }
  }, [open, member]);

  if (member === null) return null;

  const current = ROLE_PERMISSIONS[member.role];
  const next = role === '' ? null : ROLE_PERMISSIONS[role];
  const added = next === null ? [] : next.filter((permission) => !current.includes(permission));
  const removed = next === null ? [] : current.filter((permission) => !next.includes(permission));
  const roleChanged = role !== '' && role !== member.role;
  const canSave = roleChanged && authorised;

  const save = (): void => {
    if (role === '') return;
    setAuthorisationTouched(true);
    if (!authorised) return;
    changeRole.mutate(
      { id: member.id, body: { role } },
      {
        onSuccess: () => {
          toast({
            kind: 'ok',
            title: 'Permissions updated',
            message: `${member.fullName} is now ${ROLE_LABELS[role]}.`,
          });
          onOpenChange(false);
        },
        onError: (error) => {
          if (
            isApiError(error) &&
            error.status === 409 &&
            (error.code === 'self_action' || error.code === 'last_super_admin')
          ) {
            toast({
              kind: 'crit',
              title: 'Action not allowed',
              message: 'You cannot do this to your own account or the last Super Administrator.',
            });
            return;
          }
          toast({
            kind: 'crit',
            title: 'Could not update permissions',
            message: 'Please try again.',
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="um-modal-content">
        <div className="um-modal-head">
          <div>
            <span className="um-modal-eyebrow">
              <ShieldCheck size={13} aria-hidden="true" />
              Access Control — Privileged Action
            </span>
            <DialogTitle className="um-modal-title" id="um-perm-title">
              Update member permissions
            </DialogTitle>
            <DialogDescription className="um-modal-sub">
              <span>{member.fullName}</span> · <span>{ROLE_LABELS[member.role]}</span>
            </DialogDescription>
          </div>
        </div>

        <div className="um-modal-body">
          <div>
            <div className="um-modal-section-title">Member Summary</div>
            <div className="um-modal-summary">
              <div className="um-modal-summary-item">
                <span className="um-modal-summary-label">Member</span>
                <span className="um-modal-summary-value">{member.fullName}</span>
              </div>
              <div className="um-modal-summary-item">
                <span className="um-modal-summary-label">Current Role</span>
                <span className="um-modal-summary-value">{ROLE_LABELS[member.role]}</span>
              </div>
              <div className="um-modal-summary-item">
                <span className="um-modal-summary-label">Assigned Scope</span>
                <span className="um-modal-summary-value">{member.scopeSummary ?? '—'}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="um-modal-section-title">Capability Overrides</div>
            <div className="um-field">
              <label className="um-field-label" htmlFor="um-perm-role">
                New role
              </label>
              <select
                id="um-perm-role"
                className="um-select"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="">Keep {ROLE_LABELS[member.role]}…</option>
                {ROLE_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option}
                    disabled={
                      option === member.role ||
                      ((option === 'super_admin' || option === 'admin') && !isSuperAdmin)
                    }
                  >
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            {next === null ? null : (
              <div className="um-diff">
                <div className="um-diff-col">
                  <span className="um-modal-summary-label">Added capabilities</span>
                  {added.length === 0 ? (
                    <span className="um-diff-empty">None</span>
                  ) : (
                    <ul className="um-diff-list">
                      {added.map((permission) => (
                        <li className="um-diff-add" key={permission}>
                          + {permission}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="um-diff-col">
                  <span className="um-modal-summary-label">Removed capabilities</span>
                  {removed.length === 0 ? (
                    <span className="um-diff-empty">None</span>
                  ) : (
                    <ul className="um-diff-list">
                      {removed.map((permission) => (
                        <li className="um-diff-remove" key={permission}>
                          − {permission}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="um-ack-list">
            <label className="um-ack-item">
              <input
                type="checkbox"
                className="um-ovr"
                aria-label={AUTHORISATION_TEXT}
                checked={authorised}
                onChange={(event) => {
                  setAuthorised(event.target.checked);
                  setAuthorisationTouched(true);
                }}
              />
              <span className="um-ack-text">
                <span className="um-ack-title">{AUTHORISATION_TEXT}</span>
              </span>
            </label>
            {authorisationTouched && !authorised ? (
              <span className="um-field-error">{AUTHORISATION_TEXT}</span>
            ) : null}
          </div>
        </div>

        <div className="um-modal-foot">
          <span className="um-modal-foot-note" id="um-perm-hint">
            {roleChanged
              ? 'Ready to save. The change is written to the immutable audit log.'
              : 'Select at least one capability override to apply to this member.'}
          </span>
          <div className="um-modal-foot-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="um-perm-save"
              disabled={!canSave || changeRole.isPending}
              onClick={save}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Save Permission Change</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

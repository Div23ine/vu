'use client';

import { Users } from 'lucide-react';
import type { AccountStatus, StaffMember } from '@vunvault/contracts';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, TEAM_LABELS } from '@vunvault/contracts';
import { cn, formatLongDate, formatMonthYear, formatRelativeActive } from '@vunvault/lib';
import { DataTable, type DataTableProps } from '@vunvault/ui';
import { RowActions } from './row-actions';
import '../_styles/users.css';

/**
 * Staff roster table (Task 79) — Member (initials avatar, name, email, the
 * joined/suspended/invited meta line), Role, Scope & Team, the MFA/Access
 * chip (derived from `mfa`, `accountStatus` per the data section), Last
 * Active (`formatRelativeActive`) and the `ACCOUNT_STATUS_LABELS` badge.
 * The audit footnote renders under the table (the shared `DataTable` has no
 * tfoot slot).
 */

const STATUS_BADGE: Record<AccountStatus, string> = {
  active: 'adm-badge--ok',
  pending_invite: 'adm-badge--pending',
  pending_verification: 'adm-badge--pending',
  suspended: 'adm-badge--refunded',
  dormant: 'adm-badge--info',
};

/** The MFA/Access chip — the data section's derivation order. */
export function mfaChip(member: StaffMember): { text: string; tone: string } {
  if (member.accountStatus === 'suspended') return { text: 'Tokens revoked', tone: 'um-mfa--crit' };
  if (member.accountStatus === 'dormant') return { text: 'Review required', tone: 'um-mfa--warn' };
  if (member.accountStatus === 'pending_invite')
    return { text: 'Awaiting enrolment', tone: 'um-mfa--muted' };
  if (!member.mfa.enrolled) return { text: 'NOT enrolled', tone: 'um-mfa--crit' };
  if (member.mfa.methods.includes('webauthn'))
    return { text: 'Enrolled · Hardware key', tone: 'um-mfa--ok' };
  return { text: 'Enrolled · TOTP', tone: 'um-mfa--ok' };
}

function metaLine(member: StaffMember, now: Date): string {
  if (member.accountStatus === 'pending_invite') {
    return `Invited ${formatLongDate(new Date(member.joinedAt))} · Not yet accepted`;
  }
  if (member.accountStatus === 'suspended' && member.suspendedAt !== null) {
    return `Suspended ${formatLongDate(new Date(member.suspendedAt))} · Offboarding`;
  }
  if (member.accountStatus === 'dormant' && member.lastActiveAt !== null) {
    return `Last login ${formatRelativeActive(new Date(member.lastActiveAt), now)}`;
  }
  return `Joined ${formatMonthYear(new Date(member.joinedAt))} · ${member.baseLocation ?? 'Remote'}`;
}

interface RosterTableProps {
  members: StaffMember[];
  isLoading: boolean;
  activeTotal: number | null;
  canManage: boolean;
  onResetFilters(): void;
}

export function RosterTable({
  members,
  isLoading,
  activeTotal,
  canManage,
  onResetFilters,
}: RosterTableProps) {
  const now = new Date();

  const columns: DataTableProps<StaffMember>['columns'] = [
    {
      id: 'member',
      header: 'Member',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="um-identity">
          <span className="um-avatar" aria-hidden="true">
            {row.original.initials}
          </span>
          <span className="um-identity-body">
            <span className="um-name">{row.original.fullName}</span>
            <span className="um-email">{row.original.email}</span>
            <span className="um-meta-line">{metaLine(row.original, now)}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      enableSorting: false,
      cell: ({ row }) => ROLE_LABELS[row.original.role],
    },
    {
      id: 'scope',
      header: 'Scope & Team',
      enableSorting: false,
      cell: ({ row }) => (
        <span>
          <span className="um-scope">{row.original.scopeSummary ?? '—'}</span>
          <span className="um-meta-line">
            {row.original.team === null ? '—' : TEAM_LABELS[row.original.team]}
          </span>
        </span>
      ),
    },
    {
      id: 'mfa',
      header: 'MFA / Access',
      enableSorting: false,
      cell: ({ row }) => {
        const chip = mfaChip(row.original);
        return <span className={cn('um-mfa', chip.tone)}>{chip.text}</span>;
      },
    },
    {
      id: 'lastActive',
      header: 'Last Active',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="adm-mono">
          {row.original.lastActiveAt === null
            ? '—'
            : formatRelativeActive(new Date(row.original.lastActiveAt), now)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={cn('adm-badge', STATUS_BADGE[row.original.accountStatus])}>
          {ACCOUNT_STATUS_LABELS[row.original.accountStatus]}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => <RowActions member={row.original} canManage={canManage} />,
    },
  ];

  return (
    <section className="adm-card" aria-labelledby="um-roster-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="um-roster-heading">
            <Users size={17} aria-hidden="true" />
            Active Staff Roster — Security Analysts & Operators
          </h2>
          <p className="adm-card-note">
            Every account with platform access, its assigned role, permitted scope and
            authentication posture.
          </p>
        </div>
        {activeTotal === null ? null : (
          <span className="adm-tag adm-tag--ok">{activeTotal} Active</span>
        )}
      </div>
      <DataTable
        caption="Active staff roster of security analysts and operators with role, scope, MFA status and account state"
        columns={columns}
        data={members}
        isLoading={isLoading}
        empty={{
          title: 'No team members match the current filters',
          description:
            'Adjust your search terms or reset the filters to see the full staff roster.',
          action: (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onResetFilters}>
              Reset Filters
            </button>
          ),
        }}
        getRowId={(member) => member.id}
      />
      <p className="adm-note um-audit-note">
        Role changes, suspensions and permission edits are written to the immutable audit log with
        your administrator identity.
      </p>
    </section>
  );
}

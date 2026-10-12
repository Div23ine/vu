'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarCheck, Download, UserPlus } from 'lucide-react';
import { toast } from '@vunvault/ui';
import { can } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { AdminPageHead } from '../_components/admin-page-head';
import { InvitationsPanel } from './_components/invitations-panel';
import { ProvisionDialog } from './_components/provision-dialog';
import { RoleMatrix } from './_components/role-matrix';
import { RosterTable } from './_components/roster-table';
import { UsersSummary } from './_components/users-summary';
import { UsersToolbar } from './_components/users-toolbar';
import { useStaffRoster, useStaffSummary, type RosterFilters } from './_hooks/use-users';
import './_styles/users.css';

/**
 * `/admin/users` (Task 79) — User & Access Management: the summary tiles,
 * the URL-driven roster (search + role/status/MFA filters) and the
 * `users:manage` row actions. The aside renders the Task 79b slots
 * (invitations + role matrix — null stubs for now); `Provision New Member`
 * is the Task 80 dialog seam.
 *
 * Client page inside a Suspense boundary: it reads `useSearchParams` (the
 * contact-page precedent).
 */

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersView />
    </Suspense>
  );
}

function UsersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const canManage = can(user, 'users:manage');

  const filters: RosterFilters = {
    q: searchParams.get('q') ?? '',
    role: (searchParams.get('role') ?? '') as RosterFilters['role'],
    status: searchParams.get('status') ?? '',
    mfa: (searchParams.get('mfa') ?? '') as RosterFilters['mfa'],
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: PAGE_SIZE,
  };

  const roster = useStaffRoster(filters);
  const summary = useStaffSummary();
  const [provisionOpen, setProvisionOpen] = useState(false);

  const updateParams = (patch: Record<string, string>): void => {
    const params = new URLSearchParams();
    const merged = {
      q: filters.q,
      role: filters.role,
      status: filters.status,
      mfa: filters.mfa,
      ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== '') params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs === '' ? '/admin/users' : `/admin/users?${qs}`);
  };

  const resetFilters = (): void => {
    router.replace('/admin/users');
    toast({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full staff roster.',
    });
  };

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Identity, Access & Provisioning"
        title="User & Access Management"
        description="Maintain the active staff roster of security analysts and operators, review role assignments and provision new team members with least-privilege access."
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="um-invite-btn"
              onClick={() => setProvisionOpen(true)}
            >
              <UserPlus size={15} aria-hidden="true" />
              <span>Provision New Member</span>
            </button>
            <button type="button" className="adm-btn adm-btn-dark" id="um-export-roster">
              <Download size={15} aria-hidden="true" />
              <span>Export Roster</span>
            </button>
            <button type="button" className="adm-btn adm-btn-ghost" id="um-review-access">
              <CalendarCheck size={15} aria-hidden="true" />
              <span>Quarterly Access Review</span>
            </button>
          </>
        }
      />

      <section aria-labelledby="um-kpi-heading">
        <h2 id="um-kpi-heading" className="sr-only">
          Team and access indicators
        </h2>
        <UsersSummary />
      </section>

      <div className="um-grid">
        <div className="um-col">
          <UsersToolbar
            values={{ q: filters.q, role: filters.role, status: filters.status, mfa: filters.mfa }}
            shown={roster.data?.data.length ?? 0}
            total={roster.data?.total ?? 0}
            onChange={updateParams}
            onReset={resetFilters}
          />
          <RosterTable
            members={roster.data?.data ?? []}
            isLoading={roster.isLoading}
            activeTotal={summary.data?.activeMembers ?? null}
            canManage={canManage}
            onResetFilters={resetFilters}
          />
        </div>
        <aside className="um-aside" aria-label="Invitations and role matrix">
          <InvitationsPanel />
          <RoleMatrix />
        </aside>
      </div>

      <ProvisionDialog open={provisionOpen} onOpenChange={setProvisionOpen} />
    </div>
  );
}

'use client';

import { EmptyState, Skeleton } from '@vunvault/ui';
import { AdmKpi } from '../../_components/admin-page-head';
import { isForbidden } from '../../_dashboard/use-dashboard';
import { useStaffSummary } from '../_hooks/use-users';
import '../_styles/users.css';

/**
 * Team & access summary tiles — the six KPI tiles, all
 * fixture/API-driven from `GET /admin/users/summary` with the markup's
 * delta lines (the derived pair per the data section: onboarded-this-month
 * and accounts-without-MFA). 403 hides; failures degrade (an earlier iteration pattern).
 */

export function UsersSummary() {
  const summary = useStaffSummary();

  if (summary.isError && isForbidden(summary.error)) return null;

  if (summary.isLoading) {
    return (
      <div className="adm-kpi-grid" aria-busy="true">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const data = summary.data;
  if (data === undefined) {
    return (
      <div className="adm-card">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button type="button" className="adm-mini-btn" onClick={() => void summary.refetch()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="adm-kpi-grid">
      <AdmKpi
        label="Active Team Members"
        value={String(data.activeMembers)}
        delta={{ tone: 'up', text: `▲ ${data.onboardedThisMonth} onboarded this month` }}
      />
      <AdmKpi
        label="Security Analysts"
        value={String(data.securityAnalysts)}
        delta={{ tone: 'dot', text: '● Pentest & red team' }}
      />
      <AdmKpi
        label="Operators"
        value={String(data.operators)}
        delta={{ tone: 'dot', text: '● SOC & scan operations' }}
      />
      <AdmKpi
        label="Pending Invitations"
        value={String(data.pendingInvitations)}
        delta={{ tone: 'dot', text: '● Awaiting acceptance' }}
      />
      <AdmKpi
        label="MFA Enrolment"
        value={String(data.mfaEnrolmentPercent)}
        unit="%"
        delta={{ tone: 'warn', text: `${data.accountsWithoutMfa} accounts without MFA` }}
      />
      <AdmKpi
        label="Dormant Accounts"
        value={String(data.dormantAccounts)}
        delta={{ tone: 'warn', text: '▲ 60+ days inactive · review' }}
      />
    </div>
  );
}

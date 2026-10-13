'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ROLE_PERMISSIONS } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { can } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { AdminPageHead } from '../_components/admin-page-head';
import { BulkBar, type BulkActionKind } from './_components/bulk-bar';
import { QueueFooterCard } from './_components/queue-footer-card';
import { QueueSummary } from './_components/queue-summary';
import { QueueTable, type QueueRowSelection, type QueueSorting } from './_components/queue-table';
import { QueueToolbar } from './_components/queue-toolbar';
import {
  useAdminScans,
  useBulkScanAction,
  useReviewerRoster,
  useScanQueueSummary,
  type ScanQueueFilters,
} from './_hooks/use-scan-queue';
import './_styles/scan-queue.css';

/**
 * `/admin/scan-queue` (Task 77) — the Vulnerability Assessment & Job Queue:
 * summary tiles, the URL-driven filter toolbar (every view is linkable), the
 * sortable selectable `DataTable`, the bulk bar (which can NEVER release —
 * that is the Task 78 gate decision) and the mandatory-review policy card.
 *
 * Client page inside a Suspense boundary: it reads `useSearchParams` (the
 * contact-page precedent). The list polls every 15 s while visible.
 */

const PAGE_SIZE = 10;

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function paramOrEmpty(searchParams: URLSearchParams, key: string): string {
  return searchParams.get(key) ?? '';
}

export default function ScanQueuePage() {
  return (
    <Suspense fallback={null}>
      <ScanQueueView />
    </Suspense>
  );
}

function ScanQueueView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const filters: ScanQueueFilters = {
    q: paramOrEmpty(searchParams, 'q'),
    status: paramOrEmpty(searchParams, 'status') as ScanQueueFilters['status'],
    gate: paramOrEmpty(searchParams, 'gate') as ScanQueueFilters['gate'],
    payment: paramOrEmpty(searchParams, 'payment') as ScanQueueFilters['payment'],
    type: paramOrEmpty(searchParams, 'type') as ScanQueueFilters['type'],
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: PAGE_SIZE,
  };

  const list = useAdminScans(filters);
  const summary = useScanQueueSummary();
  const roster = useReviewerRoster();
  const bulk = useBulkScanAction();

  const [rowSelection, setRowSelection] = useState<QueueRowSelection>({});
  const [sorting, setSorting] = useState<QueueSorting>([]);
  const [reviewerId, setReviewerId] = useState<string | null>(null);

  const canReview = can(user, 'scans:review');

  // Active staff holding scans:review — the Assign-Reviewer roster. The
  // default is the current user when they are on it (the spec's rule).
  const reviewers = useMemo(
    () =>
      (roster.data ?? []).filter(
        (member) =>
          member.accountStatus === 'active' &&
          (ROLE_PERMISSIONS[member.role] ?? []).includes('scans:review'),
      ),
    [roster.data],
  );
  const effectiveReviewerId =
    reviewerId ??
    (user !== null && reviewers.some((member) => member.id === user.id)
      ? user.id
      : (reviewers[0]?.id ?? ''));

  const total = list.data?.total ?? 0;

  // The contract carries no sort parameter — the visible page sorts locally.
  const sortedRows = useMemo(() => {
    const rows = list.data?.data ?? [];
    const sort = sorting[0];
    if (sort === undefined) return rows;
    const direction = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (sort.id === 'job') return a.jobCode.localeCompare(b.jobCode) * direction;
      if (sort.id === 'priority')
        return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * direction;
      if (sort.id === 'status') return (a.progress - b.progress) * direction;
      return 0;
    });
  }, [list.data, sorting]);

  const selectedIds = Object.entries(rowSelection)
    .filter(([, selected]) => selected)
    .map(([id]) => id);

  const updateParams = (patch: Record<string, string>, resetPage = true): void => {
    const params = new URLSearchParams();
    const merged = {
      q: filters.q,
      status: filters.status,
      gate: filters.gate,
      payment: filters.payment,
      type: filters.type,
      ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== '') params.set(key, value);
    }
    const page = resetPage ? 1 : patch.page === undefined ? filters.page : Number(patch.page);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(qs === '' ? '/admin/scan-queue' : `/admin/scan-queue?${qs}`);
  };

  const resetFilters = (): void => {
    router.replace('/admin/scan-queue');
    toast({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full vulnerability assessment queue.',
    });
  };

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.scans.all() });
  };

  const onBulk = (action: BulkActionKind): void => {
    if (selectedIds.length === 0) {
      toast({
        kind: 'warn',
        title: 'No jobs selected',
        message: 'Select at least one job from the queue first.',
      });
      return;
    }
    const body =
      action === 'assign_reviewer' && effectiveReviewerId !== ''
        ? { action, ids: selectedIds, reviewerId: effectiveReviewerId }
        : { action, ids: selectedIds };
    bulk.mutate(body, {
      onSuccess: (result) => {
        const updated = result.updated;
        if (action === 'open_review_gate') {
          if (updated === 0 && result.skippedIds.length > 0) {
            toast({
              kind: 'warn',
              title: 'Nothing to review',
              message: 'None of the selected jobs are eligible for the review gate.',
            });
          } else {
            toast({
              kind: 'ok',
              title: 'Review gate opened',
              message: `${updated} eligible job(s) in the current selection.`,
            });
          }
        } else if (action === 'assign_reviewer') {
          const reviewer = reviewers.find((member) => member.id === effectiveReviewerId);
          const label = reviewer?.email.split('@')[0] ?? 'the selected reviewer';
          toast({
            kind: 'ok',
            title: 'Reviewer assigned',
            message: `${updated} job(s) reassigned to ${label}.`,
          });
        } else if (action === 'place_on_hold') {
          toast({
            kind: 'ok',
            title: 'Jobs placed on hold',
            message: `${updated} job(s) locked pending remediation.`,
          });
        } else {
          toast({
            kind: 'ok',
            title: 'Batch rejected',
            message: `${updated} job(s) returned to the analyst for rework.`,
          });
        }
        setRowSelection({});
      },
      onError: () => {
        toast({ kind: 'crit', title: 'Bulk action failed', message: 'Please try again.' });
      },
    });
  };

  const clearSelection = (): void => {
    setRowSelection({});
    toast({ kind: 'info', title: 'Selection cleared', message: 'No jobs are selected.' });
  };

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Vulnerability Assessment & Job Queue"
        title="Scan Queue & Job Assessment"
        description="Every penetration test, external scan and internal assessment in one queue. Client release is blocked until an administrator clears the Mandatory Admin Review Gate."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-primary" id="sq-new-job">
              <Plus size={15} aria-hidden="true" />
              <span>New Scan Request</span>
            </button>
            <button type="button" className="adm-btn adm-btn-dark" id="sq-export-queue">
              <Download size={15} aria-hidden="true" />
              <span>Export Queue</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="sq-refresh"
              onClick={refresh}
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </>
        }
      />

      <section aria-labelledby="sq-kpi-heading">
        <h2 id="sq-kpi-heading" className="sr-only">
          Queue summary indicators
        </h2>
        <QueueSummary />
      </section>

      <QueueToolbar
        values={{
          q: filters.q,
          status: filters.status,
          gate: filters.gate,
          payment: filters.payment,
          type: filters.type,
        }}
        shown={sortedRows.length}
        total={total}
        onChange={(patch) => updateParams(patch)}
        onReset={resetFilters}
      />

      <BulkBar
        selectedCount={selectedIds.length}
        reviewers={reviewers}
        reviewerId={effectiveReviewerId}
        pending={bulk.isPending}
        onReviewerChange={setReviewerId}
        onAction={onBulk}
        onClear={clearSelection}
      />

      <QueueTable
        jobs={sortedRows}
        isLoading={list.isLoading}
        awaitingReview={summary.data?.awaitingAdminReview ?? null}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        sorting={sorting}
        onSortingChange={setSorting}
        canReview={canReview}
        onResetFilters={resetFilters}
      />

      <div className="sq-footer-gap">
        <QueueFooterCard />
      </div>
    </div>
  );
}

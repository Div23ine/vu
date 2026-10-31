'use client';

import Link from 'next/link';
import { Eye, PenLine } from 'lucide-react';
import type { ContentStatus, StudioItem } from '@vunvault/contracts';
import { BLOG_CATEGORY_LABELS, CONTENT_STATUS_LABELS } from '@vunvault/contracts';
import { cn, formatLongDate } from '@vunvault/lib';
import { DataTable, type DataTableProps } from '@vunvault/ui';
import { useStudioSubmissions } from '../_hooks/use-studio';
import '../_styles/studio.css';

/**
 * My-submissions table — the author's posts on the shared
 * `DataTable`: title (with the reviewer note underneath for
 * `changes_requested` / `rejected`), category, the status chip, the updated
 * date and the action (`Edit` for the still-editable statuses, `View`
 * otherwise — both open the an earlier iteration editor, read-only for `View`).
 */

/** Status chip → semantic family (authored mapping on the chip language). */
const STATUS_TONES: Record<ContentStatus, string> = {
  draft: 'vcs-status--muted',
  pending_review: 'vcs-status--warn',
  in_review: 'vcs-status--warn',
  changes_requested: 'vcs-status--warn',
  approved: 'vcs-status--ok',
  rejected: 'vcs-status--danger',
  published: 'vcs-status--ok',
  scheduled: 'vcs-status--brand',
};

/** The statuses whose author may still edit; everything else opens read-only. */
const EDITABLE_STATUSES: ReadonlySet<ContentStatus> = new Set<ContentStatus>([
  'draft',
  'changes_requested',
]);

function hasReviewerNote(item: StudioItem): boolean {
  return (
    (item.status === 'changes_requested' || item.status === 'rejected') &&
    item.reviewerNote !== null
  );
}

export function SubmissionsTable() {
  const submissions = useStudioSubmissions();
  const items: StudioItem[] = submissions.data ?? [];

  const columns: DataTableProps<StudioItem>['columns'] = [
    {
      id: 'title',
      header: 'Title',
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <span className="vcs-cell-title">{row.original.title ?? 'Untitled article'}</span>
          {hasReviewerNote(row.original) ? (
            <span className="vcs-reviewer-note">Reviewer note: {row.original.reviewerNote}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.category === null ? '—' : BLOG_CATEGORY_LABELS[row.original.category],
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <span className={cn('vcs-status', STATUS_TONES[row.original.status])}>
          {CONTENT_STATUS_LABELS[row.original.status]}
        </span>
      ),
    },
    {
      id: 'updated',
      header: 'Updated',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="vcs-cell-date">{formatLongDate(new Date(row.original.updatedAt))}</span>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      cell: ({ row }) => {
        const editable = EDITABLE_STATUSES.has(row.original.status);
        return (
          <Link className="vcs-action-link" href={`/portal/studio/edit/${row.original.id}`}>
            {editable ? (
              <PenLine size={13} aria-hidden="true" />
            ) : (
              <Eye size={13} aria-hidden="true" />
            )}
            {editable ? 'Edit' : 'View'}
          </Link>
        );
      },
    },
  ];

  return (
    <div className="vcs-table-wrap">
      <DataTable
        caption="My submissions"
        columns={columns}
        data={items}
        isLoading={submissions.isLoading}
        empty={{
          title: 'No articles yet',
          description:
            'Start a draft — it is saved to your account and reviewed before publication.',
        }}
        getRowId={(item) => item.id}
      />
    </div>
  );
}

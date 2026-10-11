'use client';

import type { ContactMessageView, ContactStatus } from '@vunvault/contracts';
import { cn, formatQueueStamp } from '@vunvault/lib';
import { DataTable, type DataTableProps } from '@vunvault/ui';
import { CONTACT_STATUS_LABELS } from '../_hooks/use-contact-admin';

/**
 * Contact inbox table (Task 83e) — the shared `DataTable` (Task 12) over the
 * public contact queue.
 *
 * Columns are exactly the spec's: `Received`, `From` (name + email +
 * organisation), `Category`, `Subject`, `Status`, `Assigned to` and a single
 * `Open` action. The category cell renders the API-minted `categoryLabel`
 * rather than re-deriving it from `CONTACT_CATEGORY_LABELS`, because the
 * contract says that string is minted server-side.
 *
 * There is deliberately no reply affordance and no body text in the row: the
 * message is only ever shown inside the dialog, which is what keeps the
 * "do not expose the body outside `support:handle`" rule enforceable at the
 * component boundary.
 */

const STATUS_TONE: Record<ContactStatus, string> = {
  new: 'adm-badge--info',
  triaged: 'adm-badge--pending',
  closed: 'adm-badge--settled',
};

export interface InboxTableProps {
  messages: readonly ContactMessageView[];
  isLoading: boolean;
  onOpen(message: ContactMessageView): void;
  onResetFilters(): void;
}

export function InboxTable({
  messages,
  isLoading,
  onOpen,
  onResetFilters,
}: InboxTableProps) {
  // Derived from the shared table's props — apps/web has no direct
  // `@tanstack/react-table` dependency (the UI package owns it).
  const columns: DataTableProps<ContactMessageView>['columns'] = [
    {
      id: 'received',
      header: 'Received',
      cell: ({ row }) => (
        <span className="ct-received">{formatQueueStamp(new Date(row.original.createdAt))}</span>
      ),
    },
    {
      id: 'from',
      header: 'From',
      cell: ({ row }) => (
        <span className="ct-from">
          <span className="ct-from-name">{row.original.name}</span>
          <span className="ct-from-email">{row.original.email}</span>
          {row.original.organization === null ? null : (
            <span className="ct-from-org">{row.original.organization}</span>
          )}
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => <span className="ct-category">{row.original.categoryLabel}</span>,
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: ({ row }) => <span className="ct-subject">{row.original.subject}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={cn('adm-badge', STATUS_TONE[row.original.status])}>
          {CONTACT_STATUS_LABELS[row.original.status]}
        </span>
      ),
    },
    {
      id: 'assigned',
      header: 'Assigned to',
      cell: ({ row }) => (
        <span className="ct-assigned">{row.original.assignedTo?.label ?? '—'}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          type="button"
          className="adm-mini-btn ct-open"
          aria-label={`Open message from ${row.original.name}`}
          onClick={() => onOpen(row.original)}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <DataTable<ContactMessageView>
      className="ct-table-shell"
      caption="Public contact requests awaiting triage, with sender, category, status and assignee"
      columns={columns}
      data={[...messages]}
      isLoading={isLoading}
      getRowId={(row) => row.id}
      empty={{
        title: 'No messages match the current filters',
        description: 'Adjust the search or status filter to see the rest of the contact queue.',
        action: (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onResetFilters}>
            Reset Filters
          </button>
        ),
      }}
    />
  );
}

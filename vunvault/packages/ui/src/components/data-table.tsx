'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { cn } from '@vunvault/lib';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import type { DataTableProps } from './data-table.types';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

/** Placeholder row count while a query is in flight. */
const SKELETON_ROWS = 6;

/** Skeleton widths cycle through 50–90% so a loading table does not look stamped. */
const SKELETON_WIDTHS = ['w-[85%]', 'w-[55%]', 'w-[72%]', 'w-[50%]', 'w-[90%]', 'w-[62%]'];

/** Interactive elements inside a row must not trigger the row click. */
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="checkbox"], [role="switch"], [role="menuitem"]';

function stopIfInteractive(event: React.MouseEvent<HTMLTableCellElement>): void {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest(INTERACTIVE_SELECTOR) !== null) event.stopPropagation();
}

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ChevronUp size={12} className="text-brand" aria-hidden="true" />;
  if (direction === 'desc')
    return <ChevronDown size={12} className="text-brand" aria-hidden="true" />;
  return <ChevronsUpDown size={12} className="text-ink-faint" aria-hidden="true" />;
}

function ariaSortValue(direction: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return 'none';
}

/**
 * The one shared table: sticky token-styled header, server-side sorting and
 * pagination (`manualSorting` / `manualPagination`), optional row selection,
 * loading skeletons, an empty state and a visually hidden caption.
 */
export function DataTable<TData>({
  caption,
  columns,
  data,
  isLoading = false,
  empty,
  getRowId,
  sorting,
  onSortingChange,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});

  const table = useReactTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: {
      sorting: sorting ?? internalSorting,
      ...(enableRowSelection ? { rowSelection: rowSelection ?? internalSelection } : {}),
    },
    onSortingChange: onSortingChange ?? setInternalSorting,
    ...(enableRowSelection
      ? {
          enableRowSelection: true,
          onRowSelectionChange: onRowSelectionChange ?? setInternalSelection,
        }
      : {}),
    ...(getRowId ? { getRowId } : {}),
  });

  const columnCount = table.getVisibleLeafColumns().length;
  const showEmpty = !isLoading && data.length === 0;

  return (
    <div className={cn('w-full overflow-x-auto [-webkit-overflow-scrolling:touch]', className)}>
      <table className="w-full min-w-[720px] border-collapse text-[0.78rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const direction = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sortable ? ariaSortValue(direction) : undefined}
                    className={cn(
                      'sticky top-0 z-2 whitespace-nowrap border-b border-line bg-table-head',
                      'px-4 py-3 text-left text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-ink-muted',
                    )}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon direction={direction} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {Array.from({ length: columnCount }, (__, columnIndex) => (
                    <td
                      key={`skeleton-${rowIndex}-${columnIndex}`}
                      className="border-b border-line-soft px-4 py-[13px] align-middle"
                    >
                      <Skeleton
                        className={cn(
                          'h-3',
                          SKELETON_WIDTHS[(rowIndex + columnIndex) % SKELETON_WIDTHS.length],
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                  className={cn(
                    'border-b border-line-soft text-ink transition-colors duration-200 ease-vv',
                    'hover:bg-brand-tint',
                    row.getIsSelected() && 'bg-brand-tint shadow-[inset_2px_0_0_var(--brand)]',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      onClick={onRowClick ? stopIfInteractive : undefined}
                      className="border-b border-line-soft px-4 py-[13px] align-middle text-ink"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          {showEmpty ? (
            <tr>
              <td colSpan={columnCount} className="px-0 py-0">
                <EmptyState
                  title={empty.title}
                  description={empty.description}
                  action={empty.action}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

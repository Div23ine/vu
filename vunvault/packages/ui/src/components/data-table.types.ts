import type * as React from 'react';
import type { ColumnDef, OnChangeFn, RowSelectionState, SortingState } from '@tanstack/react-table';

/** Zero-result content rendered inside the table when `data` is empty. */
export interface DataTableEmpty {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export interface DataTableProps<TData> {
  /** Screen-reader description of the table. Rendered as a visually hidden caption. */
  caption: string;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Renders six skeleton rows instead of data. */
  isLoading?: boolean;
  empty: DataTableEmpty;
  getRowId?: (row: TData) => string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onRowClick?: (row: TData) => void;
  className?: string;
}

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export interface ResultCountProps {
  shown: number;
  total: number;
  /** Plural noun, e.g. `"members"` → `Showing 10 of 24 members`. */
  noun: string;
  className?: string;
}

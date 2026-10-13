import { cn } from '@vunvault/lib';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import type { PaginationProps, ResultCountProps } from './data-table.types';

/** `Showing 10 of 24 members` — the numbers are monospace so rows do not jitter. */
export function ResultCount({ shown, total, noun, className }: ResultCountProps) {
  return (
    <p className={cn('text-[0.72rem] text-ink-muted', className)}>
      Showing <strong className="font-mono font-extrabold text-ink">{shown}</strong> of{' '}
      <strong className="font-mono font-extrabold text-ink">{total}</strong> {noun}
    </p>
  );
}

/** Previous / next pager with a monospace position readout. Disabled at the ends. */
export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  const atStart = page <= 1;
  const atEnd = pageCount <= 0 || page >= pageCount;

  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-2', className)}>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Previous page"
        disabled={atStart}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </Button>
      <span className="font-mono text-[0.72rem] text-ink-muted">
        Page {page} of {pageCount}
      </span>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Next page"
        disabled={atEnd}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}

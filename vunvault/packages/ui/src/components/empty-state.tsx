import type * as React from 'react';
import { cn } from '@vunvault/lib';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Rendered below the copy, 12px from the description. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Zero-result placeholder for tables, rosters and queues. Announced as a status
 * region so a filter change that empties a list is reported without stealing focus.
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-10 text-center',
        className,
      )}
    >
      <p className="text-[0.95rem] font-extrabold text-ink">{title}</p>
      {description ? (
        <p className="max-w-[28rem] text-[0.78rem] text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

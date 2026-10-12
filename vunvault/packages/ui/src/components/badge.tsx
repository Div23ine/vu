import type * as React from 'react';
import { cn } from '@vunvault/lib';
import { cva, type VariantProps } from 'class-variance-authority';

export type BadgeTone =
  | 'ok'
  | 'settled'
  | 'pending'
  | 'refunded'
  | 'danger'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info'
  | 'neutral';

export const badgeVariants = cva(
  [
    'inline-block whitespace-nowrap rounded-full border border-transparent',
    'px-[11px] py-1 text-[9.5px] font-extrabold uppercase tracking-[0.06em]',
  ].join(' '),
  {
    variants: {
      tone: {
        ok: 'bg-ok-bg text-ok-ink border-ok-line',
        settled: 'bg-ok-bg text-ok-ink border-ok-line',
        pending: 'bg-warn-bg text-warn-ink border-warn-line',
        refunded: 'bg-danger-bg text-danger-ink border-danger-line',
        danger: 'bg-danger-bg text-danger-ink border-danger-line',
        critical: 'bg-critical/10 text-critical border-critical/30',
        high: 'bg-high/10 text-high border-high/30',
        medium: 'bg-medium/10 text-medium border-medium/30',
        low: 'bg-low/10 text-low border-low/30',
        info: 'bg-brand-tint text-brand-strong border-brand-line',
        neutral: 'bg-table-head text-ink-muted border-line',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  tone?: BadgeTone;
}

/** Compact uppercase status label — invoice state, finding severity, chip metadata. */
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

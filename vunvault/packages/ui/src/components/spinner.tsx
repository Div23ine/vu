import type * as React from 'react';
import { cn } from '@vunvault/lib';
import { cva, type VariantProps } from 'class-variance-authority';

export const spinnerVariants = cva(
  'inline-block shrink-0 animate-vv-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        sm: 'size-3',
        md: 'size-4',
        lg: 'size-6',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof spinnerVariants> {
  /** Accessible name. Defaults to `"Loading"`. */
  label?: string;
}

/**
 * Circular indeterminate progress indicator (`sm` 12px · `md` 16px · `lg` 24px).
 *
 * Uses the `vv-spin` keyframe from `styles/motion.css`; the global
 * `prefers-reduced-motion` block collapses the animation to a static ring, which
 * still communicates "busy" without movement.
 */
export function Spinner({ size = 'md', label = 'Loading', className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    />
  );
}

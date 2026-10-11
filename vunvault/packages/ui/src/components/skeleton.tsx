import type * as React from 'react';
import { cn } from '@vunvault/lib';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Content placeholder. The `vv-shimmer` sweep collapses to a single frame under
 * `prefers-reduced-motion`, leaving a static block that keeps the layout intact.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-sm bg-line-soft',
        'after:absolute after:inset-0 after:animate-[vv-shimmer_1.4s_linear_infinite]',
        'after:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--white)_65%,transparent),transparent)]',
        className,
      )}
      {...props}
    />
  );
}

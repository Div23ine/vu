import type * as React from 'react';
import { cn } from '@vunvault/lib';

export interface EyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

/**
 * Section kicker: an uppercase brand-strong label preceded by a 22px brand bar
 * (rendered with `::before`, so no extra element is added to the a11y tree).
 */
export function Eyebrow({ className, ...props }: EyebrowProps) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-strong',
        "before:block before:h-0.5 before:w-[22px] before:rounded-full before:bg-brand before:content-['']",
        className,
      )}
      {...props}
    />
  );
}

'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@vunvault/lib';

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Appends a decorative, critical-coloured ` *` for required fields. */
  required?: boolean;
}

/** Uppercase micro-label used above every field in the product. */
export function Label({ className, required = false, children, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-ink-faint',
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-critical" aria-hidden="true">
          {' '}
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
}

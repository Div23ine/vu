'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '@vunvault/lib';
import { Check, Minus } from 'lucide-react';

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

/**
 * 18px box inside a 24px hit area (the `::before` overlay), with a brand fill and
 * a white check when selected and a dash when indeterminate ("select all rows").
 *
 * The glyph is driven by Radix's `data-state`, so it works controlled and
 * uncontrolled alike.
 */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'group relative inline-grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[6px]',
        'border border-line bg-white outline-none',
        'transition-[background-color,border-color] duration-200 ease-vv',
        "before:absolute before:-inset-[3px] before:content-['']",
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        'data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center text-white">
        <Check size={12} className="group-data-[state=indeterminate]:hidden" />
        <Minus size={12} className="hidden group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

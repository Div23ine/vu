'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@vunvault/lib';

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

/** 40×22 track with an 18px thumb that travels 18px — `--line` off, `--brand` on. */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border-0',
        'bg-line outline-none transition-colors duration-200 ease-vv',
        'data-[state=checked]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-[18px] translate-x-0.5 rounded-full bg-white shadow-ghost',
          'transition-transform duration-200 ease-vv',
          'data-[state=checked]:translate-x-[18px]',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

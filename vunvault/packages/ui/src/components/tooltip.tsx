'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@vunvault/lib';

export type TooltipProviderProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>;

/** Mount once, above the app. Opens after a 200ms hover/focus delay. */
export function TooltipProvider({ delayDuration = 200, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

export interface TooltipProps {
  /** Tooltip text. Keep it short — it is not a substitute for a label. */
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Dark tooltip. The trigger stays keyboard-focusable (Radix opens on focus as
 * well as hover) so every icon-only control can be explained without a pointer.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[350] rounded-sm bg-dark px-2.5 py-1.5 text-[0.7rem] font-semibold text-white shadow-toast',
            'animate-[vv-fade-in_0.15s_var(--ease-out)_both]',
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-dark" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

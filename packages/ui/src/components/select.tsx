'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '@vunvault/lib';
import { Check, ChevronDown } from 'lucide-react';
import { fieldSurface } from './input';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;
export const SelectLabel = SelectPrimitive.Label;

export type SelectTriggerProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;

/** Trigger: the shared field surface, `appearance: none`, brand chevron at right. */
export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        fieldSurface,
        'relative inline-flex appearance-none items-center pr-[34px] text-left',
        'data-[placeholder]:text-ink-faint',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <span className="pointer-events-none absolute right-3 text-brand" aria-hidden="true">
          <ChevronDown size={14} />
        </span>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;

/** Floating panel: white, `--r-field` corners, card shadow, scrollable to 18rem. */
export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          'z-[350] max-h-72 overflow-y-auto rounded-field border border-line bg-white p-1.5 shadow-card',
          position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export type SelectItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;

/** Option row: brand tint when highlighted, brand check when selected. */
export function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center rounded-sm px-3 py-[9px] text-[0.8rem] text-ink outline-none',
        'data-[highlighted]:bg-brand-tint data-[highlighted]:text-brand-strong',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-55',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="ml-auto pl-2 text-brand" aria-hidden="true">
        <SelectPrimitive.ItemIndicator>
          <Check size={14} />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

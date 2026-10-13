'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@vunvault/lib';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

export type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;

/**
 * Dialog root. It mirrors the open state so the `body.nav-open` scroll lock can
 * follow it exactly — `DialogContent` itself stays mounted while the dialog is
 * closed (Radix only unmounts the panel), so the lock cannot live there.
 */
export function Dialog({ open, defaultOpen, onOpenChange, ...props }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('nav-open');
    return () => {
      document.body.classList.remove('nav-open');
    };
  }, [isOpen]);

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (!isControlled) setUncontrolledOpen(next);
        onOpenChange?.(next);
      }}
      {...props}
    />
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

/** Backdrop: `--dark-abyss` at 76% with a 7px blur, fading in over 0.25s. */
export function DialogOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-[300] animate-vv-overlay-in bg-dark-abyss/76 backdrop-blur-[7px]',
        className,
      )}
      {...props}
    />
  );
}

export const dialogContentVariants = cva(
  [
    'fixed left-1/2 top-1/2 z-[300] w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2',
    'max-h-[90vh] overflow-auto rounded-xl border border-line bg-white',
    'shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--black)_80%,transparent)]',
    'animate-vv-modal-pop',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'max-w-[28rem]',
        md: 'max-w-[40rem]',
        lg: 'max-w-[56rem]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface DialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  /** When false, the overlay click and Escape no longer close the dialog. */
  dismissible?: boolean;
  /** Hides the header close button. */
  hideClose?: boolean;
}

/**
 * Modal panel. Radix supplies `role="dialog"`, the focus trap, Escape-to-close
 * and focus restoration; this wrapper adds `aria-modal`, the VUNVAULT chrome and
 * the size variants. Background scrolling is frozen by `Dialog` above.
 */
export function DialogContent({
  className,
  children,
  size,
  dismissible = true,
  hideClose = false,
  onEscapeKeyDown,
  onPointerDownOutside,
  ...props
}: DialogContentProps) {
  const block = (event: { preventDefault: () => void }) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        // Radix supplies `role="dialog"`; `aria-modal` is required by the design
        // rules, and a caller can still override it through `props`.
        aria-modal="true"
        className={cn(dialogContentVariants({ size }), className)}
        onEscapeKeyDown={(event) => {
          block(event);
          onEscapeKeyDown?.(event);
        }}
        onPointerDownOutside={(event) => {
          block(event);
          onPointerDownOutside?.(event);
        }}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 inline-grid size-[34px] place-items-center rounded-full',
              'border border-white/14 bg-white/7 text-slate-muted outline-none',
              'transition-colors duration-200 ease-vv',
              'hover:border-critical/50 hover:bg-critical/30 hover:text-white',
            )}
            aria-label="Close dialog"
          >
            <X size={16} aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-[22px] pt-5 pb-4 text-white',
        'bg-[radial-gradient(90%_140%_at_100%_0%,color-mix(in_srgb,var(--brand)_18%,transparent),transparent_62%),linear-gradient(160deg,var(--dark),var(--dark-deep))]',
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-[1.05rem] font-extrabold tracking-[-0.01em] text-white', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('mt-1 text-[0.76rem] leading-[1.55] text-slate-muted', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-[22px]', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex justify-end gap-2.5 border-t border-line-soft px-[22px] py-4',
        'max-[480px]:flex-col-reverse',
        className,
      )}
      {...props}
    />
  );
}

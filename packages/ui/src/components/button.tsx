'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@vunvault/lib';
import { cva, type VariantProps } from 'class-variance-authority';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'ghost' | 'dark' | 'danger';
export type ButtonSize = 'md' | 'sm' | 'icon';

export const buttonVariants = cva(
  [
    'inline-flex cursor-pointer items-center justify-center gap-[9px] whitespace-nowrap',
    'rounded-full border border-transparent font-extrabold tracking-[0.01em]',
    'transition-[transform,filter,box-shadow,background-color,border-color,color]',
    'duration-200 ease-vv',
    'active:translate-y-px active:scale-[0.985]',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-grad-brand text-white shadow-btn-brand border-brand/50 hover:-translate-y-0.5 hover:brightness-[1.08]',
        ghost:
          'bg-white text-ink shadow-ghost border-line hover:-translate-y-0.5 hover:border-brand-line hover:text-brand-strong hover:shadow-[0_14px_30px_-20px_var(--brand-glow)]',
        dark: 'bg-[linear-gradient(160deg,var(--dark)_0%,var(--dark-abyss)_100%)] text-white border-brand/32 hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_18px_34px_-20px_var(--brand-glow)]',
        danger: 'bg-critical text-white border-critical/50 hover:brightness-[1.08]',
      },
      size: {
        md: 'px-5 py-3 text-[0.78rem]',
        sm: 'px-[14px] py-2 text-[0.72rem]',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonBaseProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    Omit<VariantProps<typeof buttonVariants>, 'variant' | 'size'> {
  variant?: ButtonVariant;
  /** Renders the loading spinner, sets `aria-busy` and disables the button. */
  loading?: boolean;
  /** Render the passed child element instead of a `<button>` (e.g. a link). */
  asChild?: boolean;
  children?: React.ReactNode;
}

/** An icon-only button has no visible text, so the accessible name is mandatory. */
export type ButtonProps =
  | (ButtonBaseProps & { size?: 'md' | 'sm'; 'aria-label'?: string })
  | (ButtonBaseProps & { size: 'icon'; 'aria-label': string });

/**
 * The single button primitive. Every call to action in the product — marketing,
 * portal and admin — is one of the four variants at one of the three sizes.
 *
 * `asChild` delegates rendering to the Radix `Slot`, which accepts exactly one
 * element child; the loading spinner is therefore only rendered for a real
 * `<button>`, where it precedes the label.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  asChild = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    // `Slot` renders the caller's element (often a link), which has no `disabled`
    // attribute — `aria-disabled` is the portable equivalent. A caller that slots
    // a real `<button>` can still pass `disabled` through `props`.
    return (
      <Slot
        className={classes}
        aria-disabled={disabled ? true : undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      // A native button defaults to `type="submit"`; default to `button` instead
      // so a stray click never submits an unrelated form.
      type={props.type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        // Decorative: the button itself exposes `aria-busy`, and a nested live
        // region would leak "Loading" into the button's accessible name.
        <Spinner size="md" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

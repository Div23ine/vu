import type * as React from 'react';
import { cn } from '@vunvault/lib';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

/** The light surface every admin and portal panel sits on. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-line bg-white shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export type DarkCardProps = CardProps;

/**
 * The dark counterpart used for hero panels, the scan console and dark toasts:
 * a brand wash over the `dark → dark-deep` gradient.
 */
export function DarkCard({ className, ...props }: DarkCardProps) {
  return (
    <Card
      className={cn(
        'border-brand/26 text-white shadow-[0_26px_56px_-34px_color-mix(in_srgb,var(--black)_70%,transparent)]',
        'bg-[radial-gradient(80%_120%_at_100%_0%,color-mix(in_srgb,var(--brand)_16%,transparent),transparent_62%),linear-gradient(160deg,var(--dark)_0%,var(--dark-deep)_100%)]',
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeadProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

/** Header row: title block on the left, actions on the right, wrapping on mobile. */
export function CardHead({ className, ...props }: CardHeadProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-[14px] border-b border-line-soft',
        'px-[22px] pt-5 pb-4',
        className,
      )}
      {...props}
    />
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Optional leading icon, rendered in the brand colour and never shrunk. */
  icon?: React.ReactNode;
  /** Heading level. `h2` is the default inside a `Card`. */
  as?: 'h2' | 'h3';
  children?: React.ReactNode;
}

/** Panel heading with an optional brand-coloured icon slot. */
export function CardTitle({
  icon,
  as: Heading = 'h2',
  className,
  children,
  ...props
}: CardTitleProps) {
  return (
    <Heading
      className={cn(
        'flex items-center gap-2.5 text-base font-extrabold tracking-[-0.01em] text-ink',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="shrink-0 text-brand" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </Heading>
  );
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

/** Panel content area. */
export function CardBody({ className, ...props }: CardBodyProps) {
  return <div className={cn('px-[22px] py-5', className)} {...props} />;
}

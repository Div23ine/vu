import type * as React from 'react';
import { cn } from '@vunvault/lib';

/**
 * The field surface shared by `Input`, `Textarea` and the `Select` trigger:
 * white, `--r-field` corners, a brand ring on focus and a critical ring when the
 * field is invalid (`aria-invalid="true"`, injected by `FormControl`).
 */
export const fieldSurface = [
  'w-full rounded-field border border-line bg-white px-[14px] py-[11px]',
  'text-[0.8rem] text-ink outline-none placeholder:text-ink-faint',
  'transition-[border-color,box-shadow] duration-200 ease-vv',
  'focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-tint)]',
  'aria-[invalid=true]:border-critical',
  'aria-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--critical)_20%,transparent)]',
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:bg-table-head',
].join(' ');

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional leading icon, positioned inside the field. Decorative. */
  icon?: React.ReactNode;
}

/** Single-line text field with an optional leading icon. */
export function Input({ className, icon, type = 'text', ...props }: InputProps) {
  if (icon === undefined) {
    return <input type={type} className={cn(fieldSurface, className)} {...props} />;
  }

  return (
    <span className="relative flex w-full items-center">
      <span className="pointer-events-none absolute left-[13px] text-ink-faint" aria-hidden="true">
        {icon}
      </span>
      <input type={type} className={cn(fieldSurface, 'pl-[38px]', className)} {...props} />
    </span>
  );
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Multi-line field — scope notes, review-gate notes, contact messages. */
export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(fieldSurface, 'min-h-24 resize-y', className)} {...props} />;
}

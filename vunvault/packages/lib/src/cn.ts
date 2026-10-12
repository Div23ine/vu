import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Join class names conditionally (`clsx`) and then resolve Tailwind conflicts so
 * the last utility wins (`tailwind-merge`). Every component in `@vunvault/ui`
 * composes its classes through this function.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

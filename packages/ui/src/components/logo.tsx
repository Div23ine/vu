/* eslint-disable @next/next/no-img-element -- `@vunvault/ui` is framework-free:
 * the brand mark is a static operator asset served from `apps/web/public`, so
 * `next/image` is deliberately not used here. */
import { cn } from '@vunvault/lib';

export interface LogoProps {
  /** Destination of the lockup. Defaults to `"/"`. */
  href?: string;
  /**
   * Path to the operator-supplied mark. The SVG is a binary asset served from
   * `apps/web/public/brand/logo.svg`; it is never inlined or generated here.
   */
  src?: string;
  /** `light` renders the wordmark in white for dark headers. */
  tone?: 'dark' | 'light';
  className?: string;
}

const LOGO_SRC = '/brand/logo.svg';

const tileClass = cn(
  'inline-grid size-[2.35rem] place-items-center rounded-tile border border-brand/35 bg-grad-tile shadow-tile',
  'transition-shadow duration-200 ease-vv',
  'group-hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--brand)_25%,transparent),0_10px_26px_-12px_var(--brand-glow)]',
);

/** The mark tile on its own — no link, no wordmark. */
export function LogoMark({ src = LOGO_SRC, className }: Pick<LogoProps, 'src' | 'className'>) {
  return (
    <span role="img" aria-label="VUNVAULT" className={cn(tileClass, className)}>
      <img src={src} alt="VUNVAULT" width={24} height={24} className="size-6 object-contain" />
    </span>
  );
}

/**
 * Brand lockup: the mark tile plus the `VUNVAULT` wordmark. Rendered as a link
 * to the site root by default, with the tile glow reacting to the whole lockup
 * through the `group` class.
 */
export function Logo({ href = '/', src = LOGO_SRC, tone = 'dark', className }: LogoProps) {
  return (
    <a
      href={href}
      aria-label="VUNVAULT home"
      className={cn('group inline-flex items-center gap-3', className)}
    >
      <span className={tileClass} aria-hidden="true">
        <img src={src} alt="VUNVAULT" width={24} height={24} className="size-6 object-contain" />
      </span>
      <span
        className={cn(
          'text-[1.25rem] font-extrabold tracking-[0.14em] md:text-[1.5rem]',
          tone === 'light' ? 'text-white' : 'text-ink',
          'transition-opacity duration-200 ease-vv group-hover:opacity-80',
        )}
      >
        VUNVAULT
      </span>
    </a>
  );
}

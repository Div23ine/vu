'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { cn } from '@vunvault/lib';
import {
  FOOTER_BOTTOM_LINKS,
  FOOTER_COPYRIGHT,
  VARIANT_COLUMNS,
  variantForPathname,
  type FooterVariant,
} from './footer-data';

/* Same reasoning as the header's brand block: the operator's static SVG,
 * pixel-identical prototype markup, `next/image` refuses SVGs by default. */
/* eslint-disable @next/next/no-img-element */

/**
 * Marketing footer (Task 44).
 *
 * `variant` picks one of the four prototype link sets; when the layout renders
 * `<SiteFooter />` bare, the variant is derived from the current route
 * (`variantForPathname`). The `contact` variant is the dark one
 * (`bg-dark text-white`, `border-t border-white/10`); the quick-links bottom
 * row and the copyright line exist on every variant.
 *
 * `Free Security Scan` does not navigate: it dispatches the
 * `vunvault:open-scanner` window event that Task 48's scanner store listens
 * for. Labels without a destination stay `<button type="button">`, exactly as
 * in the prototype.
 */

/** The window event that opens the Free Scanner dialog (Task 48 owns the listener). */
export const OPEN_SCANNER_EVENT = 'vunvault:open-scanner';

export interface SiteFooterProps {
  variant?: FooterVariant;
}

export function SiteFooter({ variant }: SiteFooterProps) {
  const pathname = usePathname() ?? '/';
  const effective = variant ?? variantForPathname(pathname);
  const columns = VARIANT_COLUMNS[effective];
  const dark = effective === 'contact';

  const linkHover = dark ? 'hover:text-white' : 'hover:text-neutral-900';
  const headingColor = dark ? 'text-white' : 'text-neutral-900';
  const bodyColor = dark ? 'text-white/60' : 'text-neutral-500';

  const openScanner = () => {
    window.dispatchEvent(new CustomEvent(OPEN_SCANNER_EVENT));
  };

  const scrollToTop = () => {
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <footer
      className={cn(
        'mt-20 border-t',
        dark
          ? 'border-white/10 bg-dark text-white'
          : 'border-neutral-200/80 bg-paper text-neutral-800',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          <div className="md:col-span-4 space-y-4">
            <Link href="/" className="flex items-center gap-3" aria-label="VUNVAULT home">
              <span className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 shadow-xs">
                <img src="/brand/logo.svg" alt="VUNVAULT" className="w-6 h-6 object-contain" />
              </span>
              <span
                className={cn(
                  'font-extrabold text-2xl tracking-wider',
                  dark ? 'text-white' : 'text-neutral-900',
                )}
              >
                VUNVAULT
              </span>
            </Link>
            <p className={cn('text-sm max-w-sm leading-relaxed', bodyColor)}>
              Africa-rooted, worldwide penetration testing, vulnerability assessments and
              cybersecurity education.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium',
                  dark ? 'bg-white/10 text-white/80' : 'text-neutral-600 bg-neutral-200/60',
                )}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                System Operational
              </span>
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {columns.map((column) => (
              <div key={column.title} className="space-y-3.5">
                <h4 className={cn('text-xs font-bold tracking-wider uppercase', headingColor)}>
                  {column.title}
                </h4>
                <ul className={cn('space-y-2 text-sm', bodyColor)}>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href !== undefined ? (
                        <Link href={link.href} className={cn('transition-colors', linkHover)}>
                          {link.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={link.action === 'scanner' ? openScanner : undefined}
                          className={cn('text-left cursor-pointer transition-colors', linkHover)}
                        >
                          {link.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'mt-16 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs',
            dark ? 'border-white/10 text-white/60' : 'border-neutral-200/80 text-neutral-500',
          )}
        >
          <div>{FOOTER_COPYRIGHT}</div>
          <div className="flex items-center gap-6">
            {FOOTER_BOTTOM_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={cn('transition-colors', linkHover)}
              >
                {link.label}
              </Link>
            ))}
            <button type="button" className={cn('transition-colors cursor-pointer', linkHover)}>
              Contact
            </button>
            <button
              type="button"
              onClick={scrollToTop}
              className={cn(
                'p-1.5 rounded-full transition-colors cursor-pointer ml-2',
                dark
                  ? 'hover:bg-white/10 text-white/70'
                  : 'hover:bg-neutral-200/60 text-neutral-600',
              )}
              aria-label="Scroll to top"
            >
              <ArrowUp size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

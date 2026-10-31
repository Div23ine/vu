'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { usePentestDialog } from './request-pentest-dialog';
import '../_styles/portal-chrome.css';

/* Brand block: static operator SVG from `/public`, pixel-identical design
 * markup — `next/image` refuses SVGs without `dangerouslyAllowSVG` (same
 * reasoning as the marketing header, an earlier iteration). */
/* eslint-disable @next/next/no-img-element */

/**
 * Client-portal header .
 *
 * Same sticky chrome as the marketing header, but the nav is the portal's four
 * reserved routes and the CTA opens the Request PenTest dialog — from the
 * desktop button (`vbb-navcta`) and from the drawer's `+ Request PenTest`
 * item, both through the shared `usePentestDialog` store. Active item = the
 * current route. The drawer behaves exactly like the marketing one: toggles
 * `.is-open`/`.is-active`, syncs `aria-expanded`, closes on route change and
 * on Escape, parks `nav-open` on `<body>` while open.
 */

export const PORTAL_NAV_ITEMS = [
  { label: 'Academy Progress', href: '/portal/academy' },
  { label: 'Free Vulnerability Scanner', href: '/portal/scanner' },
  { label: 'Billing & Invoices', href: '/portal/billing' },
  { label: 'Password Manager', href: '/portal/security' },
] as const;

const LINK_BASE =
  'relative px-2.5 py-1 text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer rounded-full';
const LINK_INACTIVE = 'font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100';
const LINK_ACTIVE = 'font-bold text-neutral-900 bg-neutral-200/60';

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalHeader() {
  const pathname = usePathname() ?? '/';
  const openDialog = usePentestDialog((state) => state.openDialog);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.classList.add('nav-open');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('nav-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);
  const requestPenTest = () => {
    closeDrawer();
    openDialog();
  };

  return (
    <header className="sticky top-0 z-50 bg-paper/95 backdrop-blur-md border-b border-neutral-200/80 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-3 group shrink-0"
          aria-label="VUNVAULT home"
        >
          <span className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <img src="/brand/logo.svg" alt="VUNVAULT" className="w-6 h-6 object-contain" />
          </span>
          <span className="font-extrabold text-xl md:text-2xl tracking-wider text-neutral-900 group-hover:opacity-80 transition-opacity">
            VUNVAULT
          </span>
        </Link>

        <nav
          className="hidden md:flex items-center gap-1.5 lg:gap-3 min-w-0 no-scrollbar"
          aria-label="Primary"
        >
          {PORTAL_NAV_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(LINK_BASE, active ? LINK_ACTIVE : LINK_INACTIVE)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="vbb-navcta"
            aria-controls="requestPenTestModal"
            onClick={openDialog}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Request PenTest</span>
          </button>
          <button
            id="mobile-menu-toggle"
            type="button"
            onClick={() => setDrawerOpen((value) => !value)}
            className={cn('hamburger', drawerOpen && 'is-active')}
            aria-label="Toggle navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-menu"
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        </div>
      </div>

      <nav
        id="mobile-menu"
        className={cn('mobile-menu', drawerOpen && 'is-open')}
        aria-label="Mobile"
      >
        <ul className="mobile-menu-list">
          {PORTAL_NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={closeDrawer}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" className="mobile-menu-login" onClick={requestPenTest}>
              + Request PenTest
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}

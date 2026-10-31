'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vunvault/lib';
import { isStaffRole } from '../../../lib/permissions';
import { useSession } from '../../../lib/session';
import { MobileMenu, type NavItem } from './mobile-menu';
import '../_styles/chrome.css';

/* The brand block is a static operator SVG from `/public`; `next/image`
 * refuses SVGs without `dangerouslyAllowSVG`, and the markup must stay
 * pixel-identical to the design (tile `w-9 h-9 rounded-xl bg-black`,
 * wordmark `tracking-wider`) — an earlier iteration's `Logo` differs (gradient tile,
 * 0.14em tracking), so the spec's escape hatch applies: markup direct. */
/* eslint-disable @next/next/no-img-element */

/**
 * Marketing header — sticky, on every `(marketing)` page.
 *
 * The nav is data-driven: one `NAV_ITEMS` list feeds both the desktop row and
 * the mobile drawer (rendered by `MobileMenu`). The active item is the current
 * route (`aria-current="page"`). The `Login` link is replaced by the session
 * profile chip when a session exists — and while the session query is still
 * loading, `Login` stays on screen so the row never shifts.
 */

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'About Us', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Blog', href: '/blog' },
  { label: 'Products', href: '/products' },
  { label: 'Contact', href: '/contact' },
];

const LINK_BASE =
  'relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full';
const LINK_INACTIVE = 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100';
const LINK_ACTIVE = 'text-neutral-900 font-bold bg-neutral-200/60';

export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const { user, isLoading } = useSession();

  const showChip = !isLoading && user !== null;
  const profileHref =
    user !== null && isStaffRole(user.role) ? '/admin/profile' : '/portal/profile';
  const initial = user?.fullName.charAt(0).toUpperCase() ?? 'U';

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
          className="hidden md:flex items-center gap-2 md:gap-4 lg:gap-6 min-w-0 overflow-x-auto no-scrollbar py-1"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => {
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
          {showChip ? (
            <Link href={profileHref} className="nav-profile">
              <span className="nav-profile-avatar" aria-hidden="true">
                {initial}
              </span>
              <span className="nav-profile-label">Profile</span>
            </Link>
          ) : (
            <Link href="/login" className={cn(LINK_BASE, LINK_INACTIVE)}>
              Login
            </Link>
          )}
        </nav>

        <MobileMenu items={NAV_ITEMS} />
      </div>
    </header>
  );
}

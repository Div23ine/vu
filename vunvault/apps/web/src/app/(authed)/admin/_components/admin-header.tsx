'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROLE_LABELS, type SessionUser } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { StatusPill } from '@vunvault/ui';
import { useSession } from '../../../../lib/session';
import { useLogout } from '../../../../lib/use-logout';
import { isAdminRouteActive, visibleAdminNavItems } from './admin-nav';
import '../_styles/admin-chrome.css';

/* Brand tile: static operator SVG from `/public`; `next/image` refuses SVGs
 * without `dangerouslyAllowSVG` (same reasoning as Tasks 44/45). */
/* eslint-disable @next/next/no-img-element */

/**
 * Command Center header (Task 46).
 *
 * Brand lockup → live status pill (`StatusPill`, Task 8) → session chip →
 * permission-filtered navigation → hamburger/drawer. `Sign Out` is a BUTTON
 * wired to `useLogout()` (the prototype's `/logout` anchor became a mutation:
 * no navigation to a dead route, cache cleared before the redirect). The
 * drawer mirrors the marketing one: `aria-expanded` in sync, closes on Escape
 * and on route change.
 *
 * Nothing here assumes a permission beyond what the session carries: the
 * server guard (`requireSession({ staff: true })`) already ran in the layout,
 * and each admin page re-checks its own permission (Task 43's `<Can>` /
 * `requireSession({ permission })`).
 */

/** First letters of first and last name, with a leading `Dr.` stripped. */
export function initialsFor(fullName: string): string {
  const withoutTitle = fullName.replace(/^Dr\.\s*/i, '');
  const parts = withoutTitle.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

export function AdminHeader() {
  const pathname = usePathname() ?? '/admin';
  const { user } = useSession();
  const logout = useLogout();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const items = user === null ? [] : visibleAdminNavItems(user);
  const close = () => setDrawerOpen(false);
  const signOut = () => {
    close();
    logout.mutate();
  };

  return (
    <header className="sticky top-0 z-50 bg-paper/95 backdrop-blur-md border-b border-neutral-200/80 transition-all duration-200">
      <div className="adm-shell py-3 adm-header-inner">
        <Link href="/admin" className="adm-brand" aria-label="VUNVAULT administrative home">
          <span className="adm-brand-tile">
            <img src="/brand/logo.svg" alt="VUNVAULT" />
          </span>
          <span>
            <span className="adm-brand-name">VUNVAULT</span>
            <span className="adm-brand-sub">Command Center</span>
          </span>
        </Link>

        <StatusPill />

        {user !== null ? <AdminUserChip user={user} /> : null}

        <nav className="adm-nav" aria-label="Administrative sections">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isAdminRouteActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
          <button type="button" className="adm-nav-signout" onClick={() => logout.mutate()}>
            Sign Out
          </button>
        </nav>

        <button
          id="adm-menu-toggle"
          type="button"
          className={cn('adm-hamburger', drawerOpen && 'is-active')}
          aria-label="Toggle administrative navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="adm-mobile-menu"
          onClick={() => setDrawerOpen((value) => !value)}
        >
          <span className="adm-hamburger-bar" />
          <span className="adm-hamburger-bar" />
          <span className="adm-hamburger-bar" />
        </button>
      </div>

      <nav
        id="adm-mobile-menu"
        className={cn('adm-drawer', drawerOpen && 'is-open')}
        aria-label="Administrative sections (mobile)"
      >
        <ul className="adm-drawer-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={close}
                aria-current={isAdminRouteActive(pathname, item.href) ? 'page' : undefined}
              >
                {item.drawerLabel}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" className="adm-drawer-signout" onClick={signOut}>
              Sign Out
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}

function AdminUserChip({ user }: { user: SessionUser }) {
  return (
    <div className="adm-user-chip">
      <span className="adm-avatar" aria-hidden="true">
        {initialsFor(user.fullName)}
      </span>
      <span className="adm-user-meta">
        <span className="adm-user-label">Logged in as</span>
        <span className="adm-user-name">{user.email}</span>
        <span className="adm-user-role">{ROLE_LABELS[user.role]}</span>
      </span>
    </div>
  );
}

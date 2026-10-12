'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@vunvault/lib';
import { isStaffRole } from '../../../lib/permissions';
import { useSession } from '../../../lib/session';

/**
 * Mobile drawer + hamburger (Task 44).
 *
 * The button toggles `.is-open` on the drawer and `.is-active` on itself,
 * keeps `aria-expanded` in sync, closes on route change and on Escape, and
 * parks `nav-open` on `<body>` while open (the same body-class contract the
 * design system's dialogs use). The item list is the header's `NAV_ITEMS`;
 * the trailing `Login` item becomes `Profile` when a session exists, styled
 * with `mobile-menu-login` exactly like the prototype.
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface MobileMenuProps {
  items: readonly NavItem[];
}

export function MobileMenu({ items }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoading } = useSession();

  // A navigation always closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: Escape closes, and <body> carries `nav-open`.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('nav-open');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('nav-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const showChip = !isLoading && user !== null;
  const profileHref =
    user !== null && isStaffRole(user.role) ? '/admin/profile' : '/portal/profile';
  const close = () => setOpen(false);

  return (
    <>
      <button
        id="mobile-menu-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn('hamburger', open && 'is-active')}
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>

      <nav id="mobile-menu" className={cn('mobile-menu', open && 'is-open')} aria-label="Mobile">
        <ul className="mobile-menu-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={close}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            {showChip ? (
              <Link href={profileHref} className="mobile-menu-login" onClick={close}>
                Profile
              </Link>
            ) : (
              <Link href="/login" className="mobile-menu-login" onClick={close}>
                Login
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </>
  );
}

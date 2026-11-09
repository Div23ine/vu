'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiPost } from '../lib/api';

const NAV = [
  { label: 'Overview', href: '/dashboard', icon: '◫' },
  { label: 'Monitors', href: '/monitors', icon: '⌁' },
  { label: 'Check history', href: '/checks', icon: '◷' },
  { label: 'Incidents', href: '/incidents', icon: '!' },
  { label: 'Status pages', href: '/status-pages', icon: '▤' },
  { label: 'Alert rules', href: '/alert-rules', icon: '⌁' },
  { label: 'Developer API', href: '/developer', icon: '{ }' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
];

export function AppShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await apiPost('/api/v1/auth/logout');
      router.replace('/login');
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="app-frame">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">U</span>
          <span><strong>UAMP HQ</strong><small>by VUNVAULT</small></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="UAMP navigation">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={active ? 'nav-link nav-active' : 'nav-link'}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
            </Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><span className="online-dot" /> Monitoring platform operational</div>
          <div className="profile-row"><span className="avatar">{userName.slice(0,1).toUpperCase()}</span><span className="profile-name">{userName}</span></div>
          <button className="signout" onClick={() => void signOut()} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation">☰</button>
          <div className="breadcrumb">VUNVAULT <span>/</span> UAMP HQ</div>
          <div className="topbar-right"><span className="live-pill"><i /> Live workspace</span><span className="topbar-user">{userName}</span></div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="app-footer"><span>UAMP HQ · VUNVAULT</span><span>Reliability visibility for every service.</span></footer>
      </div>
    </div>
  );
}
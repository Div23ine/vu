// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_PERMISSIONS, type SessionUser } from '@vunvault/contracts';
import { staffMembers } from '@vunvault/contracts/fixtures/users';
import { createQueryClient } from '@vunvault/lib';
import { mockStaffSession } from '../../../../mocks/handlers/auth';
import { server } from '../../../../mocks/server';
import { AdminFooter } from './admin-footer';
import { AdminHeader } from './admin-header';

/**
 * Command Center chrome tests (Task 46).
 *
 * Identities are the fixture roster: `mockStaffSession` is Dr. Evelyn Reed
 * (super_admin) and the auditor case maps Grace Wanjiru
 * (`staffMembers[5]`, compliance_auditor) into a SessionUser exactly like the
 * auth mock handler does.
 */

const routeState = vi.hoisted(() => ({ pathname: '/admin' }));
const routerReplace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  usePathname: () => routeState.pathname,
  useRouter: () => ({ replace: routerReplace }),
}));

const grace = staffMembers[5];
if (grace === undefined) throw new Error('Expected Grace Wanjiru at staffMembers[5].');
const auditorSession: SessionUser = {
  id: grace.id,
  email: grace.email,
  fullName: grace.fullName,
  role: grace.role,
  orgId: null,
  permissions: [...ROLE_PERMISSIONS[grace.role]],
  mfaEnrolled: grace.mfa.enrolled,
};

function useMockSession(session: SessionUser) {
  server.use(http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: session })));
}

function renderChrome() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminHeader />
      <AdminFooter />
    </QueryClientProvider>,
  );
}

function desktopNav() {
  return screen.getByRole('navigation', { name: 'Administrative sections' });
}

beforeEach(() => {
  routeState.pathname = '/admin';
});

describe('permission-filtered navigation', () => {
  it('shows a compliance_auditor only the five entries they hold', async () => {
    useMockSession(auditorSession);
    renderChrome();
    const nav = desktopNav();

    for (const label of ['Dashboard Overview', 'Scan Queue', 'Audit Logs', 'Profile Settings']) {
      await waitFor(() =>
        expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument(),
      );
    }
    expect(within(nav).getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();

    for (const label of ['User Management', 'Content Moderation', 'Zero-Day Intel']) {
      expect(within(nav).queryByRole('link', { name: label })).toBeNull();
    }
  });

  it('shows a super_admin all eight entries', async () => {
    useMockSession(mockStaffSession);
    renderChrome();
    const nav = desktopNav();

    // Eight, as the test name has always said: Task 83e added the Contact Inbox
    // (`support:handle`), which a super_admin holds.
    await waitFor(() => expect(within(nav).getAllByRole('link')).toHaveLength(8));
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Dashboard Overview',
      'Scan Queue',
      'Zero-Day Intel',
      'User Management',
      'Content Moderation',
      'Audit Logs',
      'Contact Inbox',
      'Profile Settings',
    ]);
    expect(within(nav).getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('marks the active section, /admin exactly', async () => {
    useMockSession(mockStaffSession);
    renderChrome();
    const nav = desktopNav();
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Dashboard Overview' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });
});

describe('session chip and status pill', () => {
  it('shows the email, the role label and the stripped-title initials', async () => {
    useMockSession(mockStaffSession);
    renderChrome();

    await waitFor(() => expect(screen.getByText('e.reed@vunvault.com')).toBeInTheDocument());
    expect(screen.getByText('Super Administrator')).toBeInTheDocument();
    expect(screen.getByText('Logged in as')).toBeInTheDocument();
    // "Dr. Evelyn Reed" → the title is stripped before the initials are taken.
    expect(screen.getByText('ER')).toBeInTheDocument();
  });

  it('mounts the status pill as a live region', () => {
    renderChrome();
    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent('SYS: OPERATIONAL');
  });
});

describe('Sign Out', () => {
  it('is a mutation, not a link: it clears the session and replaces to /login', async () => {
    useMockSession(mockStaffSession);
    const user = userEvent.setup();
    renderChrome();

    await waitFor(() => expect(screen.getByText('e.reed@vunvault.com')).toBeInTheDocument());
    await user.click(within(desktopNav()).getByRole('button', { name: 'Sign Out' }));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/login'));
  });
});

describe('drawer', () => {
  it('uses the long drawer labels and closes on Escape', async () => {
    useMockSession(mockStaffSession);
    const user = userEvent.setup();
    renderChrome();

    const toggle = screen.getByRole('button', { name: 'Toggle administrative navigation menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'adm-mobile-menu');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const drawer = document.getElementById('adm-mobile-menu');
    expect(drawer).toHaveClass('is-open');

    await waitFor(() =>
      expect(
        within(drawer as HTMLElement).getByRole('link', { name: 'Scan Queue & Job Assessment' }),
      ).toBeInTheDocument(),
    );
    expect(
      within(drawer as HTMLElement).getByRole('link', { name: 'User & Access Management' }),
    ).toBeInTheDocument();
    expect(
      within(drawer as HTMLElement).getByRole('link', { name: 'System Audit Logs' }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).not.toHaveClass('is-open');
  });
});

describe('AdminFooter', () => {
  it('shows the four meta pairs, the verbatim copyright and the footer links', async () => {
    useMockSession(mockStaffSession);
    renderChrome();

    expect(screen.getByText('System Build')).toBeInTheDocument();
    expect(screen.getByText('Encryption Standard')).toBeInTheDocument();
    expect(screen.getByText('Node Identifier')).toBeInTheDocument();
    expect(screen.getByText('Session Reference')).toBeInTheDocument();

    expect(screen.getByText('VUNVAULT Admin Core v4.2.1')).toBeInTheDocument();
    expect(screen.getByText('AES-256-GCM')).toBeInTheDocument();
    expect(screen.getByText('node-nbo-01 · NBO-CORE')).toBeInTheDocument();
    // ADM-<YYYY>-<MMDD>-<first 4 hex of the session id, uppercased> → C000.
    await waitFor(() => expect(screen.getByText(/^ADM-\d{4}-\d{4}-C000$/)).toBeInTheDocument());

    expect(
      screen.getByText(
        '© 2026 VUNVAULT. All rights reserved. Administrative access is logged and audited.',
      ),
    ).toBeInTheDocument();

    const footerNav = screen.getByRole('navigation', { name: 'Administrative footer' });
    expect(within(footerNav).getByRole('link', { name: 'Audit Logs' })).toHaveAttribute(
      'href',
      '/admin/audit',
    );
    expect(within(footerNav).getByRole('link', { name: 'Profile Settings' })).toHaveAttribute(
      'href',
      '/admin/profile',
    );
    expect(within(footerNav).getByRole('link', { name: 'Access Control' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
    expect(within(footerNav).getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });
});

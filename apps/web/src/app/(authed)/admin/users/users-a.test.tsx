// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffMember } from '@vunvault/contracts';
import { staffMembers, staffSummary } from '@vunvault/contracts/fixtures/users';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminUsers } from '../../../../mocks/handlers/admin-users';
import { server } from '../../../../mocks/server';
import AdminUsersPage from './page';

/**
 * User & Access Management tests (Task 79) — the spec's list: the summary
 * tiles, the roster columns and chips for the ten fixture members, the
 * URL-driven filters, action visibility by permission, the suspend confirm →
 * API call → toast chain and the last-super-admin error mapping.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const searchMock = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchMock.value,
}));

const sessionState = vi.hoisted(() => ({
  permissions: ['dashboard:read', 'users:read', 'users:manage', 'scans:read'],
}));
vi.mock('../../../../lib/session', () => ({
  useSession: () => ({
    user: {
      id: 'c0000000-0000-4000-8000-000000000001',
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      role: 'super_admin',
      orgId: null,
      permissions: sessionState.permissions,
      mfaEnrolled: true,
    },
    isLoading: false,
    isAuthenticated: true,
    isStaff: true,
    can: (permission: string) => sessionState.permissions.includes(permission),
    refetch: () => undefined,
  }),
}));

function byEmail(email: string): StaffMember {
  const found = staffMembers.find((member) => member.email === email);
  if (found === undefined) throw new Error(`The staff fixture lost ${email}.`);
  return found;
}

const REED = byEmail('e.reed@vunvault.com');
const KIMANI = byEmail('k.kimani@vunvault.com');
const MOHAMED = byEmail('a.mohamed@vunvault.com');
const NDEGWA = byEmail('p.ndegwa@vunvault.com');
const ACHIENG = byEmail('l.achieng@vunvault.com');

let queryClient: QueryClient;

function renderUsers() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminUsersPage />
    </QueryClientProvider>,
  );
}

function rosterTable(): HTMLElement {
  const table = document.querySelector('table');
  if (table === null) throw new Error('The roster table is missing.');
  return table as HTMLElement;
}

function rowOf(email: string): HTMLElement {
  const cell = within(rosterTable()).getByText(email);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`The row for ${email} is missing.`);
  return row;
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminUsers();
  routerMock.replace.mockReset();
  // Next would feed the new query back through useSearchParams; the mock has
  // to as well or the controlled inputs never move.
  routerMock.replace.mockImplementation((url: string) => {
    searchMock.value = new URLSearchParams(url.split('?')[1] ?? '');
  });
  searchMock.value = new URLSearchParams();
  sessionState.permissions = ['dashboard:read', 'users:read', 'users:manage', 'scans:read'];
});

describe('/admin/users — summary', () => {
  it('renders the six tiles from the summary fixture', async () => {
    renderUsers();
    await screen.findByText('▲ 3 onboarded this month');
    // Scope the tiles: the 79b invitations panel repeats some strings.
    const heading = screen.getByRole('heading', { name: 'Team and access indicators' });
    const kpis = heading.closest('section');
    if (kpis === null) throw new Error('The KPI section is missing.');
    expect(within(kpis).getByText('Active Team Members')).toBeInTheDocument();
    expect(within(kpis).getByText(String(staffSummary.activeMembers))).toBeInTheDocument();
    expect(within(kpis).getByText('Security Analysts')).toBeInTheDocument();
    expect(within(kpis).getByText('● Pentest & red team')).toBeInTheDocument();
    expect(within(kpis).getByText('Operators')).toBeInTheDocument();
    expect(within(kpis).getByText('● SOC & scan operations')).toBeInTheDocument();
    expect(within(kpis).getByText('Pending Invitations')).toBeInTheDocument();
    expect(within(kpis).getByText('● Awaiting acceptance')).toBeInTheDocument();
    expect(within(kpis).getByText('MFA Enrolment')).toBeInTheDocument();
    expect(within(kpis).getByText(String(staffSummary.mfaEnrolmentPercent))).toBeInTheDocument();
    expect(within(kpis).getByText('2 accounts without MFA')).toBeInTheDocument();
    expect(within(kpis).getByText('Dormant Accounts')).toBeInTheDocument();
    expect(within(kpis).getByText('▲ 60+ days inactive · review')).toBeInTheDocument();
  });
});

describe('/admin/users — roster', () => {
  it('renders the ten fixture members with their columns and chips', async () => {
    renderUsers();
    await screen.findByText(REED.email);
    for (const member of staffMembers) {
      // Mohamed also appears in the 79b invitations panel.
      expect(within(rosterTable()).getByText(member.email)).toBeInTheDocument();
    }

    // Member cell: avatar, name, meta line; role; scope; MFA chip; status.
    const reed = rowOf(REED.email);
    expect(within(reed).getByText('ER')).toBeInTheDocument();
    expect(within(reed).getByText('Dr. Evelyn Reed')).toBeInTheDocument();
    expect(within(reed).getByText('Super Administrator')).toBeInTheDocument();
    expect(within(reed).getByText('Full platform · All modules')).toBeInTheDocument();
    expect(within(reed).getByText('Enrolled · Hardware key')).toBeInTheDocument();
    expect(within(reed).getByText('Active')).toBeInTheDocument();
    expect(within(reed).getByText(/Joined Mar 2024 · Nairobi HQ/)).toBeInTheDocument();

    // The un-enrolled operator gets the NOT chip and the Enforce MFA action.
    const kimani = rowOf(KIMANI.email);
    expect(within(kimani).getByText('NOT enrolled')).toBeInTheDocument();
    expect(within(kimani).getByRole('button', { name: 'Enforce MFA' })).toBeInTheDocument();

    // The invited member awaits enrolment.
    const mohamed = rowOf(MOHAMED.email);
    expect(within(mohamed).getByText('Awaiting enrolment')).toBeInTheDocument();
    expect(within(mohamed).getByText('Pending Invite')).toBeInTheDocument();

    // The suspended member: tokens revoked + Reactivate/Delete.
    const ndegwa = rowOf(NDEGWA.email);
    expect(within(ndegwa).getByText('Tokens revoked')).toBeInTheDocument();
    expect(within(ndegwa).getByText('Suspended')).toBeInTheDocument();
    expect(within(ndegwa).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(within(ndegwa).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(ndegwa).getByText(/· Offboarding/)).toBeInTheDocument();

    // The dormant member: review required.
    const achieng = rowOf(ACHIENG.email);
    expect(within(achieng).getByText('Review required')).toBeInTheDocument();
    expect(within(achieng).getByText('Dormant')).toBeInTheDocument();

    // Card chrome + audit footnote.
    expect(
      screen.getByRole('heading', {
        name: 'Active Staff Roster — Security Analysts & Operators',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${staffSummary.activeMembers} Active`)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Role changes, suspensions and permission edits are written to the immutable audit log with your administrator identity.',
      ),
    ).toBeInTheDocument();
  });

  it('filters are URL-driven: ?role=security_analyst and ?q= narrow the roster', async () => {
    searchMock.value = new URLSearchParams('role=security_analyst');
    renderUsers();
    const analysts = staffMembers.filter((member) => member.role === 'security_analyst');
    expect(analysts.length).toBeGreaterThan(0);
    await screen.findByText(analysts[0]?.email ?? '');
    for (const member of analysts) {
      expect(within(rosterTable()).getByText(member.email)).toBeInTheDocument();
    }
    for (const member of staffMembers.filter(
      (candidate) => candidate.role !== 'security_analyst',
    )) {
      expect(within(rosterTable()).queryByText(member.email)).not.toBeInTheDocument();
    }
  });

  it('search drives the URL and Reset toasts', async () => {
    const user = userEvent.setup();
    renderUsers();
    await screen.findByText(REED.email);
    // One controlled change event — the mocked useSearchParams is not
    // reactive, so per-character typing would race the value prop.
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'mwangi' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/users?q=mwangi');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/users');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full staff roster.',
    });
  });

  it('without users:manage the roster is read-only', async () => {
    sessionState.permissions = ['dashboard:read', 'users:read'];
    renderUsers();
    await screen.findByText(REED.email);
    expect(screen.queryByRole('button', { name: 'Permissions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enforce MFA' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Edit profile for ${REED.fullName}` }),
    ).not.toBeInTheDocument();
  });
});

describe('/admin/users — row writes', () => {
  it('suspend confirms, posts the reason and toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    const calls: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.post('*/api/v1/admin/users/:id/suspend', async ({ request }) => {
        calls.push({ url: request.url, body: await request.json() });
        const member = staffMembers.find((candidate) => candidate.email === KIMANI.email);
        return HttpResponse.json({ data: { ...member, accountStatus: 'suspended' } });
      }),
    );
    renderUsers();
    await screen.findByText(KIMANI.email);
    await user.click(within(rowOf(KIMANI.email)).getByRole('button', { name: 'Suspend' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(`Suspend ${KIMANI.fullName}?`)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason \(optional/), 'Repeated policy breaches');
    await user.click(within(dialog).getByRole('button', { name: 'Suspend account' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.url).toContain(KIMANI.id);
    expect(calls[0]?.body).toMatchObject({ reason: 'Repeated policy breaches' });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Account suspended',
        message: `${KIMANI.email} — all active session tokens revoked immediately.`,
      }),
    );
  });

  it('the last-super-admin 409 maps to the verbatim crit toast', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/admin/users/:id/suspend', () =>
        HttpResponse.json({ error: 'last_super_admin' }, { status: 409 }),
      ),
    );
    renderUsers();
    await screen.findByText(REED.email);
    await user.click(within(rowOf(REED.email)).getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Suspend account' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'crit',
        title: 'Action not allowed',
        message: 'You cannot do this to your own account or the last Super Administrator.',
      }),
    );
  });

  it('the profile editor action toasts the read-only pair', async () => {
    const user = userEvent.setup();
    renderUsers();
    await screen.findByText(REED.email);
    await user.click(screen.getByRole('button', { name: `Edit profile for ${REED.fullName}` }));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'info',
      title: 'Profile editor',
      message: `${REED.fullName} — editing name, title, team and scope assignment.`,
    });
  });
});

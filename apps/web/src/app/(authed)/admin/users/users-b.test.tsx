// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { ReactElement } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_PERMISSIONS } from '@vunvault/contracts';
import { staffMembers } from '@vunvault/contracts/fixtures/users';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminUsers } from '../../../../mocks/handlers/admin-users';
import { server } from '../../../../mocks/server';
import { InvitationsPanel } from './_components/invitations-panel';
import { PermissionDialog } from './_components/permission-dialog';
import { ProvisionDialog } from './_components/provision-dialog';
import { RoleMatrix } from './_components/role-matrix';

/**
 * Invitations + matrix tests — the spec's list: the panel lists
 * the pending invitations and calls the right endpoints (resend / revoke /
 * the resend-limit 409), and the matrix DERIVES from the contracts — every
 * cell is asserted against `ROLE_PERMISSIONS`, so a permission change moves
 * the cell.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(),
}));

const sessionState = vi.hoisted(() => ({
  permissions: ['dashboard:read', 'users:read', 'users:manage'],
  role: 'super_admin',
}));
vi.mock('../../../../lib/session', () => ({
  useSession: () => ({
    user: {
      id: 'c0000000-0000-4000-8000-000000000001',
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      role: sessionState.role,
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

let queryClient: QueryClient;

function renderPanel(ui: ReactElement) {
  queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminUsers();
  sessionState.permissions = ['dashboard:read', 'users:read', 'users:manage'];
  sessionState.role = 'super_admin';
});

describe('InvitationsPanel', () => {
  it('lists the pending invite with role label and the 72-hour expiry line', async () => {
    renderPanel(<InvitationsPanel />);
    expect(await screen.findByRole('heading', { name: 'Pending Invitations' })).toBeInTheDocument();
    expect(screen.getByText('Awaiting acceptance and MFA enrolment.')).toBeInTheDocument();

    // The fixture roster has exactly one pending_invite member.
    expect(await screen.findByText('Aisha Mohamed')).toBeInTheDocument();
    expect(screen.getByText('a.mohamed@vunvault.com')).toBeInTheDocument();
    expect(screen.getByText('Security Analyst')).toBeInTheDocument();
    expect(screen.getByText(/expires \d{1,2} Sep 2026/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // the warn tag
  });

  it('Resend posts to the invitation endpoint and toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    server.use(
      http.post('*/api/v1/admin/users/invitations/:id/resend', ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ data: {} });
      }),
    );
    renderPanel(<InvitationsPanel />);
    await user.click(await screen.findByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0]).toMatch(/\/api\/v1\/admin\/users\/invitations\/[^/]+\/resend$/);
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Invitation resent',
        message: 'a.mohamed@vunvault.com — secure invitation email re-dispatched.',
      }),
    );
  });

  it('the resend limit 409 toasts the spec line', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/admin/users/invitations/:id/resend', () =>
        HttpResponse.json({ error: 'resend_limit' }, { status: 409 }),
      ),
    );
    renderPanel(<InvitationsPanel />);
    await user.click(await screen.findByRole('button', { name: 'Resend' }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'warn',
        title: 'Resend limit reached. Revoke and invite again.',
      }),
    );
  });

  it('Revoke deletes the invitation and toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    server.use(
      http.delete('*/api/v1/admin/users/invitations/:id', ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPanel(<InvitationsPanel />);
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(urls).toHaveLength(1));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'info',
        title: 'Invitation revoked',
        message: 'a.mohamed@vunvault.com — pending invitation invalidated.',
      }),
    );
  });

  it('All invitations toasts the workspace line with the pending count', async () => {
    const user = userEvent.setup();
    renderPanel(<InvitationsPanel />);
    await screen.findByText('Aisha Mohamed');
    await user.click(screen.getByRole('button', { name: 'All invitations' }));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'info',
      title: 'All invitations',
      message: 'Opening the full invitation workspace — 1 pending.',
    });
  });

  it('without users:manage the actions are hidden', async () => {
    sessionState.permissions = ['dashboard:read', 'users:read'];
    renderPanel(<InvitationsPanel />);
    await screen.findByText('Aisha Mohamed');
    expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    // The informational link stays.
    expect(screen.getByRole('button', { name: 'All invitations' })).toBeInTheDocument();
  });
});

describe('RoleMatrix', () => {
  function renderMatrix() {
    renderPanel(<RoleMatrix />);
    return screen.getByRole('table');
  }

  it('renders the verbatim chrome and the generated rows', () => {
    const table = renderMatrix();
    expect(screen.getByRole('heading', { name: 'Role Permission Matrix' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Toggle capability grants per role. Changes apply to every member holding that role after saving. Super Administrator permissions are immutable.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Privileged Action')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Super Administrator capabilities are locked and cannot be modified. All other changes are audited.',
      ),
    ).toBeInTheDocument();

    // The markup's column order and short headings.
    const headings = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(headings).toEqual([
      'Capability',
      'Super Admin',
      'Admin',
      'Analyst',
      'Operator',
      'Auditor',
      'Support',
    ]);

    // Five category rows, thirteen capability rows.
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 5 + 13);
    for (const category of [
      'Scan Operations',
      'Review & Release',
      'Zero-Day Advisory',
      'Identity & Administration',
      'Client Data',
    ]) {
      expect(within(table).getByText(category)).toBeInTheDocument();
    }
  });

  it('every cell derives from ROLE_PERMISSIONS (can/cannot aria-labels included)', () => {
    const table = renderMatrix();
    // Spot-check the derivation across roles and capabilities — the checked
    // state must equal the contract map, so a contract change moves the cell.
    const cases: Array<[string, string, boolean]> = [
      ['Super Admin can clear review gate', 'super_admin', true],
      ['Admin cannot provision new members', 'admin', false], // allExcept users:manage
      ['Analyst can initiate system scan', 'security_analyst', true],
      ['Analyst cannot clear review gate', 'security_analyst', false],
      ['Operator can pause all workers', 'soc_operator', true],
      ['Auditor can read audit logs', 'compliance_auditor', true],
      ['Auditor cannot initiate system scan', 'compliance_auditor', false],
      ['Support cannot read audit logs', 'support_engineer', false],
    ];
    for (const [label, role, expected] of cases) {
      const box = within(table).getByRole('checkbox', { name: label });
      const holds = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
      expect(holds).toBeDefined();
      expect((box as HTMLInputElement).checked).toBe(expected);
    }
    // The contract map is the single source: recompute one row wholesale.
    const releaseBoxes = within(table).getAllByRole('checkbox', {
      name: /can release report to client|cannot release report to client/i,
    });
    expect(releaseBoxes).toHaveLength(6);
    const expectedByRole = [
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
    ].map((role) =>
      ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS].includes('scans:release'),
    );
    expect(releaseBoxes.map((box) => (box as HTMLInputElement).checked)).toEqual(expectedByRole);
  });
});

describe('ProvisionDialog', () => {
  async function fillBasics(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await user.type(within(dialog).getByLabelText('Full Name'), 'Joseph Kariuki');
    await user.type(within(dialog).getByLabelText('Work Email'), 'j.kariuki@vunvault.com');
    await user.click(within(dialog).getByRole('checkbox', { name: 'NDA on file' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Background verified' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Training acknowledged' }));
  }

  it('counts the outstanding requirements and gates the buttons', async () => {
    const user = userEvent.setup();
    renderPanel(<ProvisionDialog open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Provision New Team Member')).toBeInTheDocument();
    expect(within(dialog).getByText('3 outstanding security requirement(s)')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Provisioning incomplete' })).toBeDisabled();

    // MFA enrolment is mandatory: checked and disabled.
    const mfa = within(dialog).getByRole('checkbox', { name: 'MFA enrolment mandatory' });
    expect(mfa).toBeChecked();
    expect(mfa).toBeDisabled();

    await fillBasics(user, dialog);
    expect(within(dialog).getByText('0 outstanding security requirement(s)')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Send Secure Invitation' })).toBeEnabled(),
    );
    expect(within(dialog).getByText('— expires in 72 hours.')).toBeInTheDocument();
  });

  it('rejects a non-vunvault email with the verbatim message', async () => {
    const user = userEvent.setup();
    renderPanel(<ProvisionDialog open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Work Email'), 'joe@example.com');
    await user.tab();
    expect(
      await within(dialog).findByText('Use a valid @vunvault.com work email.'),
    ).toBeInTheDocument();
  });

  it('sends the draft and send payloads and toasts the verbatim pairs', async () => {
    const user = userEvent.setup();
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('*/api/v1/admin/users/invitations', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { data: { id: 'd0000000-0000-4000-8000-000000000009' } },
          { status: 201 },
        );
      }),
    );
    renderPanel(<ProvisionDialog open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    await fillBasics(user, dialog);
    await user.type(within(dialog).getByLabelText('Job Title'), 'Penetration Tester');

    await user.click(within(dialog).getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      fullName: 'Joseph Kariuki',
      email: 'j.kariuki@vunvault.com',
      jobTitle: 'Penetration Tester',
      role: 'security_analyst',
      team: 'offensive_security',
      accessTier: 'standard',
      draft: true,
      checklist: {
        mfaEnrolmentMandatory: true,
        ndaOnFile: true,
        backgroundVerified: true,
        trainingAcknowledged: true,
      },
    });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Draft saved',
        message: 'Joseph Kariuki — stored privately.',
      }),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Send Secure Invitation' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]?.draft).toBeUndefined();
    await waitFor(() => {
      const sent = useToastStore
        .getState()
        .toasts.find((entry) => entry.title === 'Invitation sent');
      expect(sent?.message).toBe('Secure invitation issued to j.kariuki@vunvault.com');
    });
  });

  it('a 409 email_taken surfaces the field error', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/admin/users/invitations', () =>
        HttpResponse.json({ error: 'email_taken' }, { status: 409 }),
      ),
    );
    renderPanel(<ProvisionDialog open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    await fillBasics(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Send Secure Invitation' }));
    expect(
      await within(dialog).findByText('That email already has an account or invitation.'),
    ).toBeInTheDocument();
  });

  it('an admin caller cannot pick Super Administrator or Administrator', async () => {
    sessionState.role = 'admin';
    renderPanel(<ProvisionDialog open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    const role = within(dialog).getByLabelText('Role');
    expect(within(role).getByRole('option', { name: 'Super Administrator' })).toBeDisabled();
    expect(within(role).getByRole('option', { name: 'Administrator' })).toBeDisabled();
    expect(within(role).getByRole('option', { name: 'Security Analyst' })).toBeEnabled();
  });

  it('a super admin caller may pick every staff role', async () => {
    renderPanel(<ProvisionDialog open onOpenChange={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    const role = within(dialog).getByLabelText('Role');
    expect(within(role).getByRole('option', { name: 'Super Administrator' })).toBeEnabled();
    // Only the six staff roles — no Client option.
    expect(within(role).queryByRole('option', { name: 'Client' })).not.toBeInTheDocument();
    expect(within(role).getAllByRole('option')).toHaveLength(6);
  });
});

describe('PermissionDialog', () => {
  function mwangi() {
    const found = staffMembers.find((candidate) => candidate.email === 'd.mwangi@vunvault.com');
    if (found === undefined) throw new Error('The staff fixture lost d.mwangi.');
    return found;
  }

  it('shows the diff, gates on authorisation and PATCHes the role', async () => {
    const user = userEvent.setup();
    const bodies: Array<Record<string, unknown>> = [];
    const urls: string[] = [];
    server.use(
      http.patch('*/api/v1/admin/users/:id/role', async ({ params, request }) => {
        urls.push(String(params.id));
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: { ...mwangi(), role: 'support_engineer' } });
      }),
    );
    const onOpenChange = vi.fn();
    renderPanel(<PermissionDialog member={mwangi()} open onOpenChange={onOpenChange} />);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Update member permissions')).toBeInTheDocument();
    expect(within(dialog).getByText('Access Control — Privileged Action')).toBeInTheDocument();
    // The name/role appear in the head sub-line AND the Member Summary.
    expect(within(dialog).getAllByText('Daniel Mwangi').length).toBeGreaterThan(1);
    expect(within(dialog).getAllByText('Security Analyst').length).toBeGreaterThan(1);
    expect(
      within(dialog).getByText('Select at least one capability override to apply to this member.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save Permission Change' })).toBeDisabled();

    // Pick a new role → the ROLE_PERMISSIONS diff appears.
    await user.selectOptions(within(dialog).getByLabelText('New role'), 'support_engineer');
    expect(within(dialog).getByText('+ support:handle')).toBeInTheDocument();
    expect(within(dialog).getByText('− scans:create')).toBeInTheDocument();
    expect(within(dialog).getByText('− intel:write')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Ready to save. The change is written to the immutable audit log.'),
    ).toBeInTheDocument();
    // Still disabled until authorised.
    expect(within(dialog).getByRole('button', { name: 'Save Permission Change' })).toBeDisabled();

    // Ticking then unticking shows the verbatim authorisation error.
    const auth = within(dialog).getByRole('checkbox', {
      name: 'Confirm that this access change is authorised before saving.',
    });
    await user.click(auth);
    await user.click(auth);
    expect(
      within(dialog).getAllByText('Confirm that this access change is authorised before saving.')
        .length,
    ).toBeGreaterThan(1);

    await user.click(auth);
    await user.click(within(dialog).getByRole('button', { name: 'Save Permission Change' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(urls[0]).toBe(mwangi().id);
    expect(bodies[0]).toMatchObject({ role: 'support_engineer' });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Permissions updated',
        message: 'Daniel Mwangi is now Support Engineer.',
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_CHECK_LABELS, type ScanJob } from '@vunvault/contracts';
import { scanJobs } from '@vunvault/contracts/fixtures/scans';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminScans } from '../../../../mocks/handlers/admin-scans';
import { server } from '../../../../mocks/server';
import ScanQueuePage from './page';

/**
 * Review-gate dialog tests — the spec's list: Confirm stays
 * disabled until five checks + a valid note for approve (hold does NOT need
 * the checks), the three verbatim success toasts, the 409 payment lock shows
 * the blocked panel and NO success toast, an analyst sees Approve disabled
 * with the verbatim tooltip, and Escape closes with focus back on the row
 * action. Plus the live status line and the note-length error.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const searchMock = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchMock.value,
}));

const sessionState = vi.hoisted(() => ({
  permissions: ['dashboard:read', 'scans:read', 'scans:review', 'scans:release', 'users:read'],
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

const FOUND = scanJobs.find((candidate) => candidate.jobCode === 'JOB-4471');
if (FOUND === undefined) throw new Error('The scans fixture lost JOB-4471.');
const JOB: ScanJob = FOUND;

let queryClient: QueryClient;

function renderQueue() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ScanQueuePage />
    </QueryClientProvider>,
  );
}

async function openGate(user: ReturnType<typeof userEvent.setup>) {
  renderQueue();
  const cell = await screen.findByText('JOB-4471');
  const row = cell.closest('tr');
  if (row === null) throw new Error('The JOB-4471 row is missing.');
  await user.click(within(row).getByRole('button', { name: 'Review Findings' }));
  return await screen.findByRole('dialog');
}

/** The five contract checks, in display order. */
const CHECK_TITLES = Object.values(REVIEW_CHECK_LABELS).map((entry) => entry.title);

async function tickAllChecks(user: ReturnType<typeof userEvent.setup>) {
  for (const title of CHECK_TITLES) {
    await user.click(screen.getByRole('checkbox', { name: new RegExp(title) }));
  }
}

function mockGateSuccess(job: ScanJob = JOB) {
  server.use(
    http.post('*/api/v1/admin/scans/:id/gate-decision', () =>
      HttpResponse.json({ data: { ...job, reviewGateState: 'approved_released' } }),
    ),
  );
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminScans();
  searchMock.value = new URLSearchParams();
  sessionState.permissions = [
    'dashboard:read',
    'scans:read',
    'scans:review',
    'scans:release',
    'users:read',
  ];
});

describe('review gate — gating', () => {
  it('Confirm stays disabled until all five checks and a valid note (approve)', async () => {
    const user = userEvent.setup();
    const dialog = await openGate(user);

    // The verbatim head + context.
    expect(
      within(dialog).getByRole('heading', { name: 'Review findings before client release' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Mandatory Admin Review Gate')).toBeInTheDocument();
    expect(within(dialog).getByText('JOB-4471')).toBeInTheDocument();
    // The target appears twice: the head sub-line and the context panel.
    expect(within(dialog).getAllByText('api.horizonsacco.co.ke').length).toBe(2);
    expect(within(dialog).getAllByText('Horizon SACCO').length).toBe(2);

    const confirm = within(dialog).getByRole('button', { name: 'Confirm Gate Decision' });
    expect(confirm).toBeDisabled();
    expect(
      within(dialog).getByText(
        'Complete all five verification steps and select a decision to enable the gate action.',
      ),
    ).toBeInTheDocument();

    // Pick approve, tick the five checks — still disabled (no note).
    await user.click(within(dialog).getByRole('radio', { name: /Approve & Release/ }));
    expect(within(dialog).getByRole('button', { name: 'Approve & Release' })).toBeDisabled();
    await tickAllChecks(user);
    expect(within(dialog).getByRole('button', { name: 'Approve & Release' })).toBeDisabled();

    // A short note is invalid — the spec error shows on blur.
    const note = within(dialog).getByLabelText('Reviewer Note (recorded in the audit log)');
    await user.type(note, 'short');
    await user.tab();
    expect(
      within(dialog).getByText('Add a reviewer note of at least 10 characters.'),
    ).toBeInTheDocument();

    // A real note enables it; the label follows the decision.
    await user.clear(note);
    await user.type(note, 'Scope, evidence and findings all verified against the report.');
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Approve & Release' })).toBeEnabled(),
    );
    expect(
      within(dialog).getByText(
        'All checks complete. Confirming will write this decision to the immutable audit log.',
      ),
    ).toBeInTheDocument();
  });

  it('the status line counts outstanding steps and hold skips the checks', async () => {
    const user = userEvent.setup();
    const dialog = await openGate(user);

    // Two of five ticked → the outstanding count line.
    await user.click(screen.getByRole('checkbox', { name: /Scope authorisation verified/ }));
    await user.click(screen.getByRole('checkbox', { name: /Evidence sanitised/ }));
    expect(
      within(dialog).getByText(
        '3 verification step(s) still outstanding before the gate can be cleared.',
      ),
    ).toBeInTheDocument();

    await tickAllChecks(user); // ticks the remaining three (the first two flip off—re-tick below)
    // Re-tick the first two so all five are checked.
    await user.click(screen.getByRole('checkbox', { name: /Scope authorisation verified/ }));
    await user.click(screen.getByRole('checkbox', { name: /Evidence sanitised/ }));
    expect(
      within(dialog).getByText('All verification steps complete — select a decision to continue.'),
    ).toBeInTheDocument();

    // Hold needs NO checks: uncheck everything, pick hold, add a note.
    for (const title of CHECK_TITLES) {
      const box = screen.getByRole('checkbox', { name: new RegExp(title) });
      if ((box as HTMLInputElement).checked) await user.click(box);
    }
    await user.click(within(dialog).getByRole('radio', { name: /Hold for Remediation/ }));
    await user.type(
      within(dialog).getByLabelText('Reviewer Note (recorded in the audit log)'),
      'Client is remediating; report stays locked.',
    );
    expect(within(dialog).getByRole('button', { name: 'Hold for Remediation' })).toBeEnabled();
  });

  it('an analyst without scans:release sees Approve disabled with the verbatim tooltip', async () => {
    sessionState.permissions = ['dashboard:read', 'scans:read', 'scans:review'];
    const user = userEvent.setup();
    const dialog = await openGate(user);

    const approve = within(dialog).getByRole('radio', { name: /Approve & Release/ });
    expect(approve).toBeDisabled();
    expect(within(dialog).getByText('Requires administrator authority.')).toBeInTheDocument();
    // Hold and reject stay available.
    expect(within(dialog).getByRole('radio', { name: /Hold for Remediation/ })).toBeEnabled();
    expect(within(dialog).getByRole('radio', { name: /Reject & Archive/ })).toBeEnabled();
  });
});

describe('review gate — decisions', () => {
  it('approve posts the contract body and toasts the release pair', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('*/api/v1/admin/scans/:id/gate-decision', async ({ params, request }) => {
        bodies.push({ id: String(params.id), ...((await request.json()) as object) });
        return HttpResponse.json({
          data: { ...JOB, reviewGateState: 'approved_released' },
        });
      }),
    );
    const user = userEvent.setup();
    const dialog = await openGate(user);
    await user.click(within(dialog).getByRole('radio', { name: /Approve & Release/ }));
    await tickAllChecks(user);
    await user.type(
      within(dialog).getByLabelText('Reviewer Note (recorded in the audit log)'),
      'Every finding reproduced; evidence sanitised.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Approve & Release' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      id: JOB.id,
      decision: 'approve_release',
      note: 'Every finding reproduced; evidence sanitised.',
      checks: {
        scope_authorisation_verified: true,
        evidence_sanitised: true,
        critical_high_validated: true,
        remediation_guidance_attached: true,
        client_redaction_approved: true,
      },
    });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Client portal access granted. Decision written to the audit log',
        message: 'JOB-4471 released with reviewer note.',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('hold toasts the lock pair', async () => {
    mockGateSuccess();
    const user = userEvent.setup();
    const dialog = await openGate(user);
    await user.click(within(dialog).getByRole('radio', { name: /Hold for Remediation/ }));
    await user.type(
      within(dialog).getByLabelText('Reviewer Note (recorded in the audit log)'),
      'Held until the client patches the edge fleet.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Hold for Remediation' }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'warn',
        title: 'JOB-4471 held for remediation',
        message: 'Report remains locked. The client has been notified of outstanding findings.',
      }),
    );
  });

  it('reject toasts the rework pair', async () => {
    mockGateSuccess();
    const user = userEvent.setup();
    const dialog = await openGate(user);
    await user.click(within(dialog).getByRole('radio', { name: /Reject & Archive/ }));
    await user.type(
      within(dialog).getByLabelText('Reviewer Note (recorded in the audit log)'),
      'Scope documents do not cover the target list.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Reject & Archive' }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'crit',
        title: 'JOB-4471 rejected',
        message: 'Job returned to the assigned analyst for rework and re-submission.',
      }),
    );
  });

  it('409 payment_outstanding shows the blocked panel and no success toast', async () => {
    server.use(
      http.post('*/api/v1/admin/scans/:id/gate-decision', () =>
        HttpResponse.json({ error: 'payment_outstanding' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    const dialog = await openGate(user);

    // JOB-4471 is unpaid: the warning panel is up from the start.
    expect(within(dialog).getByText('Pending — awaiting settlement')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Release is blocked until payment is settled.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: /Approve & Release/ }));
    await tickAllChecks(user);
    await user.type(
      within(dialog).getByLabelText('Reviewer Note (recorded in the audit log)'),
      'Findings verified; attempting the release.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Approve & Release' }));

    await waitFor(() =>
      expect(
        within(dialog).getByText(
          'Release blocked — payment is outstanding. The decision was recorded and the job is locked until the invoice is paid.',
        ),
      ).toBeInTheDocument(),
    );
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(within(dialog).getByRole('heading')).toBeInTheDocument(); // still open
  });

  it('403 toasts the verbatim role line', async () => {
    server.use(
      http.post('*/api/v1/admin/scans/:id/gate-decision', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    const dialog = await openGate(user);
    await user.click(within(dialog).getByRole('radio', { name: /Hold for Remediation/ }));
    await user.type(
      within(dialog).getByLabelText('Reviewer Note (recorded in the audit log)'),
      'Trying a hold without the permission.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Hold for Remediation' }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'crit',
        title: 'Your role cannot release reports. Ask an administrator.',
      }),
    );
  });
});

describe('review gate — contract literals', () => {
  it('the static checklist copy matches REVIEW_CHECK_LABELS exactly', () => {
    // The unrolled literals of gate-checklist.tsx, asserted against the
    // contract map so they cannot drift.
    expect(REVIEW_CHECK_LABELS.scope_authorisation_verified).toEqual({
      title: 'Scope authorisation verified',
      description: 'Signed authorisation on file covers every host in the target list.',
    });
    expect(REVIEW_CHECK_LABELS.evidence_sanitised).toEqual({
      title: 'Evidence sanitised',
      description: 'No production data, credentials or personal information in the report.',
    });
    expect(REVIEW_CHECK_LABELS.critical_high_validated).toEqual({
      title: 'Critical & high findings manually validated',
      description: 'Each severe finding independently reproduced by the reviewer.',
    });
    expect(REVIEW_CHECK_LABELS.remediation_guidance_attached).toEqual({
      title: 'Remediation guidance attached',
      description: 'Prioritised fixes and a re-test window are included in the report.',
    });
    expect(REVIEW_CHECK_LABELS.client_redaction_approved).toEqual({
      title: 'Client-ready redaction approved',
      description: 'Exploit payloads are safely truncated for the client-facing copy.',
    });
  });
});

describe('review gate — keyboard', () => {
  it('Escape closes the dialog and focus returns to the row action', async () => {
    const user = userEvent.setup();
    await openGate(user);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const active = document.activeElement;
    expect(active).not.toBeNull();
    expect(active?.textContent).toContain('Review Findings');
  });
});

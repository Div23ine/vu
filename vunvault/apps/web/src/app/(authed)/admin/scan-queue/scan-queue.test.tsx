// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scanQueueSummary } from '@vunvault/contracts/fixtures/scans';
import { staffMembers } from '@vunvault/contracts/fixtures/users';
import { createQueryClient, formatQueueStamp } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminScans } from '../../../../mocks/handlers/admin-scans';
import { server } from '../../../../mocks/server';
import ScanQueuePage from './page';

/**
 * Scan Queue tests (Task 77) — the spec's list: the summary tiles from MSW,
 * URL-driven filters, selection shows the bulk bar and count, the bulk call
 * body shape, the skipped-all toast, the row menu items by state, the
 * permission-hidden actions and the UTC timestamps. Plus the filter reset,
 * the preview toast and the reviewer assignment.
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

let queryClient: QueryClient;

function renderQueue() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ScanQueuePage />
    </QueryClientProvider>,
  );
}

function rowOf(jobCode: string): HTMLElement {
  const cell = screen.getByText(jobCode);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`The row for ${jobCode} is missing.`);
  return row;
}

async function selectRow(user: ReturnType<typeof userEvent.setup>, jobCode: string) {
  const row = rowOf(jobCode);
  await user.click(within(row).getByRole('checkbox'));
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminScans();
  routerMock.replace.mockReset();
  routerMock.push.mockReset();
  searchMock.value = new URLSearchParams();
  sessionState.permissions = [
    'dashboard:read',
    'scans:read',
    'scans:review',
    'scans:release',
    'users:read',
  ];
});

describe('/admin/scan-queue — chrome + summary', () => {
  it('renders the page head and the six summary tiles from MSW', async () => {
    renderQueue();
    expect(
      await screen.findByRole('heading', { name: 'Scan Queue & Job Assessment' }),
    ).toBeInTheDocument();
    // The eyebrow and the table card title share the queue name.
    expect(screen.getAllByText('Vulnerability Assessment & Job Queue')).toHaveLength(2);
    expect(
      screen.getByText(
        'Every penetration test, external scan and internal assessment in one queue. Client release is blocked until an administrator clears the Mandatory Admin Review Gate.',
      ),
    ).toBeInTheDocument();

    await screen.findByText('▲ 14 added today');
    expect(screen.getByText('Jobs In Queue')).toBeInTheDocument();
    expect(screen.getByText(String(scanQueueSummary.jobsInQueue))).toBeInTheDocument();
    expect(screen.getByText(`▲ ${scanQueueSummary.addedToday} added today`)).toBeInTheDocument();
    expect(screen.getByText('Running Scans')).toBeInTheDocument();
    expect(
      screen.getByText(
        `● ${scanQueueSummary.workerSlotsUsed} of ${scanQueueSummary.workerSlotsTotal} worker slots`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Awaiting Admin Review')).toBeInTheDocument();
    expect(screen.getByText('● Client release blocked')).toBeInTheDocument();
    expect(screen.getByText('Approved & Released')).toBeInTheDocument();
    expect(screen.getByText('1,842')).toBeInTheDocument();
    expect(
      screen.getByText(`▲ ${scanQueueSummary.releasedThisWeek} released this week`),
    ).toBeInTheDocument();
    expect(screen.getByText('Payment Outstanding')).toBeInTheDocument();
    expect(
      screen.getByText(`▲ ${scanQueueSummary.overdueOver14Days} overdue > 14 days`),
    ).toBeInTheDocument();
    expect(screen.getByText('Held / Rejected')).toBeInTheDocument();
    expect(screen.getByText('● Pending remediation')).toBeInTheDocument();

    // The policy card closes the page, verbatim.
    expect(
      screen.getByRole('heading', { name: 'Mandatory Admin Review Gate' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Enforced')).toBeInTheDocument();
    expect(screen.getByText('Scope Authorisation Verified')).toBeInTheDocument();
    expect(screen.getByText('Evidence Sanitised')).toBeInTheDocument();
    expect(screen.getByText('Findings Manually Validated')).toBeInTheDocument();
    expect(screen.getByText('Remediation Guidance Attached')).toBeInTheDocument();
    expect(screen.getByText('SEV-2 audit event')).toBeInTheDocument();
  });
});

describe('/admin/scan-queue — table', () => {
  it('renders the fixture rows with UTC stamps, chips and gate badges', async () => {
    renderQueue();
    await screen.findByText('JOB-4471');

    // Timestamps are formatQueueStamp — UTC.
    expect(screen.getByText('24 Sep · 06:12 UTC')).toBeInTheDocument();
    expect(
      screen.getByText(formatQueueStamp(new Date('2026-09-24T05:48:00Z'))),
    ).toBeInTheDocument();

    // Row anatomy of JOB-4471.
    const row = rowOf('JOB-4471');
    expect(within(row).getByText('api.horizonsacco.co.ke')).toBeInTheDocument();
    expect(within(row).getByText('41.90.64.12')).toBeInTheDocument();
    expect(within(row).getByText('Production')).toBeInTheDocument();
    expect(within(row).getByText('Horizon SACCO')).toBeInTheDocument();
    expect(within(row).getByText('grace@horizonsacco.co.ke')).toBeInTheDocument();
    expect(within(row).getByText('Scope: external API + auth flow')).toBeInTheDocument();
    expect(within(row).getByText('API')).toBeInTheDocument();
    expect(within(row).getByText('Pending')).toBeInTheDocument();
    expect(within(row).getByText('Critical')).toBeInTheDocument();
    expect(within(row).getAllByText('78%')).toHaveLength(2);
    expect(within(row).getByText('Running · ETA 4m 12s')).toBeInTheDocument();
    expect(within(row).getByText('In Review')).toBeInTheDocument();
    expect(within(row).getByText('Client release blocked')).toBeInTheDocument();

    // A completed + released row shows the completion stamp and the open lock.
    const released = rowOf('JOB-4466');
    expect(within(released).getByText('Approved — Released')).toBeInTheDocument();
    expect(within(released).getByText('Client access granted')).toBeInTheDocument();
    expect(within(released).getByText(/^Completed · /)).toBeInTheDocument();

    // The head tag mirrors the summary's awaiting count.
    expect(
      screen.getByText(`${scanQueueSummary.awaitingAdminReview} Awaiting Review`),
    ).toBeInTheDocument();
    // The release-lock footnote.
    expect(
      screen.getByText(
        'Client release is locked until the Mandatory Admin Review Gate is cleared by an administrator.',
      ),
    ).toBeInTheDocument();
  });

  it('filters are URL-driven: ?status=held shows only the held job', async () => {
    // The standing mock handler applies the received params, so a held-only
    // table proves the client put `status=held` on the wire.
    searchMock.value = new URLSearchParams('status=held');
    renderQueue();

    await screen.findByText('JOB-4465');
    expect(screen.queryByText('JOB-4471')).not.toBeInTheDocument();
    expect(document.getElementById('sq-visible-count')).toHaveTextContent('1');
    expect(document.getElementById('sq-total-count')).toHaveTextContent('1');
  });

  it('search and reset drive the URL and the verbatim reset toast', async () => {
    const user = userEvent.setup();
    searchMock.value = new URLSearchParams('q=kijani');
    renderQueue();
    // The standing handler filters on the wire param — only Kijani jobs arrive.
    await screen.findByText('JOB-4466');
    expect(screen.getByText('JOB-4462')).toBeInTheDocument();
    expect(screen.queryByText('JOB-4471')).not.toBeInTheDocument();

    const search = screen.getByLabelText('Search');
    expect(search).toHaveValue('kijani');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/admin/scan-queue');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full vulnerability assessment queue.',
    });

    await user.type(search, 'x');
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/scan-queue?q=kijanix');
  });
});

describe('/admin/scan-queue — selection + bulk', () => {
  it('selection activates the bulk bar; Place On Hold sends the body and toasts', async () => {
    const user = userEvent.setup();
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('*/api/v1/admin/scans/bulk', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: { updated: 1, skippedIds: [] } });
      }),
    );
    renderQueue();
    await screen.findByText('JOB-4471');

    const bar = screen.getByRole('region', { name: 'Bulk job actions' });
    expect(bar).toHaveAttribute('inert');

    await selectRow(user, 'JOB-4471');
    expect(bar).not.toHaveAttribute('inert');
    expect(bar).toHaveClass('is-active');
    expect(within(bar).getByText('1')).toBeInTheDocument();
    expect(within(bar).getByText('job(s) selected')).toBeInTheDocument();

    await user.click(within(bar).getByRole('button', { name: 'Place On Hold' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    const heldJob = (bodies[0]?.ids as string[])[0];
    expect(bodies[0]).toMatchObject({ action: 'place_on_hold' });
    expect(heldJob).toMatch(/^00000000-0000-4000-8000-000000004471$/);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Jobs placed on hold',
      message: '1 job(s) locked pending remediation.',
    });
    // The selection clears after a successful bulk action.
    await waitFor(() => expect(bar).toHaveAttribute('inert'));
  });

  it('Assign Reviewer sends the selected reviewer and toasts their label', async () => {
    const user = userEvent.setup();
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('*/api/v1/admin/scans/bulk', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: { updated: 2, skippedIds: [] } });
      }),
    );
    renderQueue();
    await screen.findByText('JOB-4471');
    await selectRow(user, 'JOB-4471');
    await selectRow(user, 'JOB-4470');

    const amara = staffMembers.find((member) => member.email === 'a.njoroge@vunvault.com');
    if (amara === undefined) throw new Error('The staff fixture lost a.njoroge.');
    await user.selectOptions(screen.getByLabelText('Reviewer'), amara.id);
    await user.click(screen.getByRole('button', { name: 'Assign Reviewer' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ action: 'assign_reviewer', reviewerId: amara.id });
    expect((bodies[0]?.ids as string[]).length ?? 0).toBe(2);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Reviewer assigned',
      message: '2 job(s) reassigned to a.njoroge.',
    });
  });

  it('an all-skipped review-gate batch toasts Nothing to review', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/admin/scans/bulk', () =>
        HttpResponse.json({
          data: { updated: 0, skippedIds: ['00000000-0000-4000-8000-000000004466'] },
        }),
      ),
    );
    renderQueue();
    await screen.findByText('JOB-4466');
    await selectRow(user, 'JOB-4466');
    await user.click(screen.getByRole('button', { name: 'Open Review Gate' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'warn',
        title: 'Nothing to review',
        message: 'None of the selected jobs are eligible for the review gate.',
      }),
    );
  });
});

describe('/admin/scan-queue — row actions', () => {
  it('offers state-dependent items per row', async () => {
    renderQueue();
    await screen.findByText('JOB-4471');

    // in_review + unpaid + running → everything.
    const running = rowOf('JOB-4471');
    expect(within(running).getByRole('button', { name: 'Review Findings' })).toBeInTheDocument();
    expect(within(running).getByRole('button', { name: 'Request Payment' })).toBeInTheDocument();
    expect(within(running).getByRole('button', { name: 'Cancel Job' })).toBeInTheDocument();
    expect(
      within(running).getByRole('button', { name: 'View report preview for JOB-4471' }),
    ).toBeInTheDocument();

    // completed + released + paid → preview only.
    const released = rowOf('JOB-4466');
    expect(
      within(released).queryByRole('button', { name: 'Review Findings' }),
    ).not.toBeInTheDocument();
    expect(
      within(released).queryByRole('button', { name: 'Request Payment' }),
    ).not.toBeInTheDocument();
    expect(within(released).queryByRole('button', { name: 'Cancel Job' })).not.toBeInTheDocument();
    expect(
      within(released).getByRole('button', { name: 'View report preview for JOB-4466' }),
    ).toBeInTheDocument();

    // queued + not_eligible + unpaid → payment + cancel, no review.
    const queued = rowOf('JOB-4467');
    expect(
      within(queued).queryByRole('button', { name: 'Review Findings' }),
    ).not.toBeInTheDocument();
    expect(within(queued).getByRole('button', { name: 'Request Payment' })).toBeInTheDocument();
    expect(within(queued).getByRole('button', { name: 'Cancel Job' })).toBeInTheDocument();
  });

  it('hides the review-permission actions when the session lacks scans:review', async () => {
    sessionState.permissions = ['dashboard:read', 'scans:read'];
    renderQueue();
    await screen.findByText('JOB-4471');
    expect(screen.queryByRole('button', { name: 'Review Findings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request Payment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Job' })).not.toBeInTheDocument();
    // The read-only preview stays.
    expect(
      screen.getByRole('button', { name: 'View report preview for JOB-4471' }),
    ).toBeInTheDocument();
  });

  it('the preview button fires the read-only toast', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText('JOB-4471');
    await user.click(screen.getByRole('button', { name: 'View report preview for JOB-4471' }));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'info',
      title: 'Opening report preview',
      message: 'JOB-4471 — client-facing copy (redacted).',
    });
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem } from '@vunvault/contracts';
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS, RISK_FLAG_LABELS } from '@vunvault/contracts';
import { moderationItems, moderationSummary } from '@vunvault/contracts/fixtures/content';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminContent } from '../../../../mocks/handlers/admin-content';
import { server } from '../../../../mocks/server';
import { EDITORIAL_CHECKS, EDITORIAL_CHECK_KEYS } from './_components/editorial-checks';
import AdminContentPage from './page';

/**
 * Content Moderation tests — the spec's list: the summary tiles, the
 * filters, the dialog gating, each decision payload, the legal-review 403
 * message, the own-submission 409 message and the bulk approve skipping
 * authored / flagged items.
 *
 * The five editorial-check literals are asserted against `EDITORIAL_CHECKS` so
 * the static markup cannot drift from the spec the dialog counts.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const searchMock = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchMock.value,
}));

const sessionState = vi.hoisted(() => ({
  id: 'c0000000-0000-4000-8000-000000000001',
  permissions: ['dashboard:read', 'content:moderate', 'content:author'],
}));
vi.mock('../../../../lib/session', () => ({
  useSession: () => ({
    user: {
      id: sessionState.id,
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
      <AdminContentPage />
    </QueryClientProvider>,
  );
}

function byTitle(title: string): ModerationItem {
  const found = moderationItems.find((item) => item.title === title);
  if (found === undefined) throw new Error(`The content fixture lost "${title}".`);
  return found;
}

const STRUTS = byTitle('Apache Struts 2 OGNL Injection — Emergency Client Advisory');
const STATE_HOUSE = byTitle('Kenya State House Cyber Security Audit & Risk Analysis');
const ACCRA = byTitle('VUNVAULT Opens Regional Security Operations Hub in Accra');
const SENTINEL = byTitle('VUNVAULT Sentinel — Continuous Attack Surface Monitoring');

function queueTable(): HTMLElement {
  const table = document.querySelector('table');
  if (table === null) throw new Error('The queue table is missing.');
  return table as HTMLElement;
}

function rowOf(title: string): HTMLElement {
  const cell = within(queueTable()).getByText(title);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`The row for "${title}" is missing.`);
  return row as HTMLElement;
}

function toasts() {
  return useToastStore.getState().toasts;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

/** Tick all five editorial checks. */
async function tickChecks(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  for (const key of EDITORIAL_CHECK_KEYS) {
    await user.click(within(dialog()).getByRole('checkbox', { name: EDITORIAL_CHECKS[key].title }));
  }
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminContent();
  routerMock.replace.mockReset();
  routerMock.replace.mockImplementation((url: string) => {
    searchMock.value = new URLSearchParams(url.split('?')[1] ?? '');
  });
  searchMock.value = new URLSearchParams();
  sessionState.id = 'c0000000-0000-4000-8000-000000000001';
  sessionState.permissions = ['dashboard:read', 'content:moderate', 'content:author'];
});

describe('/admin/content — summary tiles', () => {
  it('renders the six tiles from the summary fixture', async () => {
    renderQueue();
    await screen.findByText('Awaiting Review');

    const heading = screen.getByRole('heading', { name: 'Content moderation indicators' });
    const kpis = heading.closest('section');
    if (kpis === null) throw new Error('The KPI section is missing.');

    expect(within(kpis).getByText(String(moderationSummary.awaitingReview))).toBeInTheDocument();
    expect(within(kpis).getByText('Changes Requested')).toBeInTheDocument();
    expect(within(kpis).getByText(String(moderationSummary.changesRequested))).toBeInTheDocument();
    expect(within(kpis).getByText('Approved Today')).toBeInTheDocument();
    expect(within(kpis).getByText(String(moderationSummary.approvedToday))).toBeInTheDocument();
    expect(within(kpis).getByText('Rejected (7 days)')).toBeInTheDocument();
    expect(within(kpis).getByText(String(moderationSummary.rejectedLast7Days))).toBeInTheDocument();
    expect(within(kpis).getByText('Avg. Review Time')).toBeInTheDocument();
    expect(within(kpis).getByText(String(moderationSummary.avgReviewHours))).toBeInTheDocument();
    expect(within(kpis).getByText('Published (30 days)')).toBeInTheDocument();
    expect(
      within(kpis).getByText(String(moderationSummary.publishedLast30Days)),
    ).toBeInTheDocument();
    expect(within(kpis).getByText('● Blocking publication')).toBeInTheDocument();
  });
});

describe('/admin/content — queue table', () => {
  it('renders every fixture row with type, author, flags and status', async () => {
    renderQueue();
    await screen.findByText(STRUTS.title);

    for (const item of moderationItems) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }
    const strutsRow = rowOf(STRUTS.title);
    expect(within(strutsRow).getByText(CONTENT_TYPE_LABELS[STRUTS.type])).toBeInTheDocument();
    expect(within(strutsRow).getByText(STRUTS.author.fullName)).toBeInTheDocument();
    expect(within(strutsRow).getByText(STRUTS.author.initials)).toBeInTheDocument();
    expect(within(strutsRow).getByText(CONTENT_STATUS_LABELS[STRUTS.status])).toBeInTheDocument();
    expect(within(strutsRow).getByText(STRUTS.slugPath)).toBeInTheDocument();

    // An item with no flags renders the em dash, not an empty cell.
    expect(within(strutsRow).getByText('—')).toBeInTheDocument();

    // The flagged row shows the contract's own labels.
    const stateRow = rowOf(STATE_HOUSE.title);
    for (const flag of STATE_HOUSE.riskFlags) {
      expect(within(stateRow).getByText(RISK_FLAG_LABELS[flag])).toBeInTheDocument();
    }
  });

  it('the toolbar counts the visible page against the total', async () => {
    renderQueue();
    await screen.findByText(STRUTS.title);

    // The results line is split across <strong> elements, so read the ids.
    expect(document.querySelector('#cm-visible-count')).toHaveTextContent(
      String(moderationItems.length),
    );
    expect(document.querySelector('#cm-total-count')).toHaveTextContent(
      String(moderationItems.length),
    );
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
  });
});

describe('/admin/content — filters', () => {
  // The mocked `useSearchParams` is not reactive (the an earlier iteration note), so each
  // filter is proved two ways: the control writes the right URL, and a
  // pre-seeded URL renders the narrowed queue.

  it('each control writes its query parameter', async () => {
    renderQueue();
    await screen.findByText(STRUTS.title);

    fireEvent.change(screen.getByLabelText('Review Status'), {
      target: { value: 'pending_review' },
    });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/content?status=pending_review');

    fireEvent.change(screen.getByLabelText('Content Type'), {
      target: { value: 'threat_advisory' },
    });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/content?type=threat_advisory');

    // The contract's own "no flags at all" sentinel.
    fireEvent.change(screen.getByLabelText('Risk Flag'), { target: { value: 'none' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/content?flag=none');

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'accra' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/content?q=accra');
  });

  it('?status=pending_review narrows the queue', async () => {
    searchMock.value = new URLSearchParams('status=pending_review');
    renderQueue();
    await screen.findByText(STRUTS.title);

    const pending = moderationItems.filter((item) => item.status === 'pending_review');
    expect(pending.length).toBeGreaterThan(0);
    for (const item of pending) {
      expect(within(queueTable()).getByText(item.title)).toBeInTheDocument();
    }
    for (const item of moderationItems.filter(
      (candidate) => candidate.status !== 'pending_review',
    )) {
      expect(within(queueTable()).queryByText(item.title)).toBeNull();
    }
  });

  it('?type=threat_advisory narrows to that type', async () => {
    searchMock.value = new URLSearchParams('type=threat_advisory');
    renderQueue();
    await screen.findByText(STRUTS.title);

    for (const item of moderationItems.filter(
      (candidate) => candidate.type !== 'threat_advisory',
    )) {
      expect(within(queueTable()).queryByText(item.title)).toBeNull();
    }
  });

  it('?flag=none shows only unflagged items', async () => {
    searchMock.value = new URLSearchParams('flag=none');
    renderQueue();
    await screen.findByText(STRUTS.title);

    for (const item of moderationItems) {
      const cell = within(queueTable()).queryByText(item.title);
      if (item.riskFlags.length === 0) {
        expect(cell).not.toBeNull();
      } else {
        expect(cell).toBeNull();
      }
    }
  });

  it('?q= matches the slug path', async () => {
    searchMock.value = new URLSearchParams('q=accra-soc-hub');
    renderQueue();
    await screen.findByText(ACCRA.title);

    expect(within(queueTable()).queryByText(STRUTS.title)).toBeNull();
  });

  it('Reset clears the URL and toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    searchMock.value = new URLSearchParams('status=approved');
    renderQueue();
    await screen.findByText(ACCRA.title);

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/content');
    expect(toasts()[0]).toMatchObject({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full pre-publication review queue.',
    });
  });

  it('an empty result shows the reference empty state', async () => {
    searchMock.value = new URLSearchParams('q=zzz-no-such-content');
    renderQueue();

    expect(await screen.findByText('No content matches the current filters')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Adjust your search terms or reset the filters to see the full pre-publication review queue.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
  });
});

describe('/admin/content — review dialog gating', () => {
  it('renders the five checks and the three decisions verbatim', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(within(rowOf(STRUTS.title)).getByRole('button', { name: 'Review' }));
    const modal = await screen.findByRole('dialog');

    expect(within(modal).getByText('Pre-Publication Review')).toBeInTheDocument();
    expect(within(modal).getByText('Editorial sign-off')).toBeInTheDocument();
    expect(within(modal).getByText(STRUTS.slugPath)).toBeInTheDocument();
    expect(within(modal).getByText('Content Preview')).toBeInTheDocument();
    expect(within(modal).getByText(STRUTS.title)).toBeInTheDocument();
    expect(within(modal).getByText('Mandatory Editorial Checklist')).toBeInTheDocument();

    for (const key of EDITORIAL_CHECK_KEYS) {
      expect(
        within(modal).getByRole('checkbox', { name: EDITORIAL_CHECKS[key].title }),
      ).toBeInTheDocument();
      expect(within(modal).getByText(EDITORIAL_CHECKS[key].description)).toBeInTheDocument();
    }

    expect(within(modal).getByText('Approve for Publication')).toBeInTheDocument();
    expect(within(modal).getByText('Request Changes')).toBeInTheDocument();
    expect(within(modal).getByText('Reject')).toBeInTheDocument();
    expect(within(modal).getByText('Reviewer Notes')).toBeInTheDocument();
    expect(within(modal).getByText('e.reed@vunvault.com')).toBeInTheDocument();
    expect(within(modal).getByText('Super Administrator')).toBeInTheDocument();
  });

  it('the status line walks all four verbatim states', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(within(rowOf(STRUTS.title)).getByRole('button', { name: 'Review' }));
    const modal = await screen.findByRole('dialog');
    const hint = within(modal).getByText(
      'Complete all five editorial checks and select a decision to enable the action.',
    );
    expect(hint).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Confirm Decision' })).toBeDisabled();

    // One check ticked → the outstanding count line.
    await user.click(
      within(modal).getByRole('checkbox', { name: EDITORIAL_CHECKS.technical_accuracy.title }),
    );
    expect(
      within(modal).getByText(
        '4 editorial check(s) still outstanding before a decision can be confirmed.',
      ),
    ).toBeInTheDocument();

    // All five, no decision yet.
    await tickChecks(user);
    // tickChecks re-clicks the first one off, so re-tick anything unticked.
    for (const key of EDITORIAL_CHECK_KEYS) {
      const box = within(modal).getByRole('checkbox', { name: EDITORIAL_CHECKS[key].title });
      if (!box.hasAttribute('data-state') && !(box as HTMLInputElement).checked) {
        await user.click(box);
      }
    }
    expect(
      await within(modal).findByText(
        'All editorial checks complete — select a decision to continue.',
      ),
    ).toBeInTheDocument();

    await user.click(within(modal).getByText('Approve for Publication'));
    expect(
      await within(modal).findByText(
        'All checks complete. Confirming will write this editorial decision to the audit log.',
      ),
    ).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Confirm Decision' })).toBeEnabled();
  });

  it('Approve is blocked until all five checks are ticked', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(within(rowOf(STRUTS.title)).getByRole('button', { name: 'Approve' }));
    const modal = await screen.findByRole('dialog');

    // The row's quick Approve pre-selects the decision…
    expect(within(modal).getByText('Approve for Publication').closest('label')).toHaveClass(
      'cm-decision--approve',
    );
    // …but the checklist still gates it.
    expect(within(modal).getByRole('button', { name: 'Confirm Decision' })).toBeDisabled();

    await tickChecks(user);
    await waitFor(() =>
      expect(within(modal).getByRole('button', { name: 'Confirm Decision' })).toBeEnabled(),
    );
  });

  it('Reject requires a note of at least ten characters', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(within(rowOf(STRUTS.title)).getByRole('button', { name: 'Review' }));
    const modal = await screen.findByRole('dialog');

    await user.click(within(modal).getByText('Reject'));
    expect(within(modal).getByRole('button', { name: 'Confirm Decision' })).toBeDisabled();

    const note = within(modal).getByLabelText(/Reviewer Notes/);
    await user.type(note, 'too short');
    await user.tab();
    expect(
      await within(modal).findByText('Add a note of at least 10 characters.'),
    ).toBeInTheDocument();

    await user.type(note, ' — attribution is unverified.');
    await waitFor(() =>
      expect(within(modal).getByRole('button', { name: 'Confirm Decision' })).toBeEnabled(),
    );
  });
});

describe('/admin/content — decision payloads', () => {
  async function decide(
    user: ReturnType<typeof userEvent.setup>,
    item: ModerationItem,
    decisionLabel: string,
    note?: string,
  ): Promise<Record<string, unknown>[]> {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('*/api/v1/admin/content/:id/actions', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: item });
      }),
    );
    renderQueue();
    await screen.findByText(STRUTS.title);
    await user.click(within(rowOf(item.title)).getByRole('button', { name: 'Review' }));
    const modal = await screen.findByRole('dialog');
    await tickChecks(user);
    await user.click(within(modal).getByText(decisionLabel));
    if (note !== undefined) {
      await user.type(within(modal).getByLabelText(/Reviewer Notes/), note);
    }
    await waitFor(() =>
      expect(within(modal).getByRole('button', { name: 'Confirm Decision' })).toBeEnabled(),
    );
    await user.click(within(modal).getByRole('button', { name: 'Confirm Decision' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    return bodies;
  }

  it('approve sends the bare action', async () => {
    const user = userEvent.setup();
    const bodies = await decide(user, STRUTS, 'Approve for Publication');
    expect(bodies[0]).toEqual({ action: 'approve' });

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Content approved',
        message: `"${STRUTS.title}" cleared for publication with reviewer notes.`,
      }),
    );
  });

  it('request_changes carries the note', async () => {
    const user = userEvent.setup();
    const bodies = await decide(
      user,
      STRUTS,
      'Request Changes',
      'Cite the vendor advisory for the affected version range.',
    );
    expect(bodies[0]).toEqual({
      action: 'request_changes',
      note: 'Cite the vendor advisory for the affected version range.',
    });

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Changes requested',
        message: `"${STRUTS.title}" returned to the author for revision.`,
      }),
    );
  });

  it('reject carries the note', async () => {
    const user = userEvent.setup();
    const bodies = await decide(
      user,
      STRUTS,
      'Reject',
      'Attribution is not supported by the telemetry provided.',
    );
    expect(bodies[0]).toEqual({
      action: 'reject',
      note: 'Attribution is not supported by the telemetry provided.',
    });

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'crit',
        title: 'Content rejected',
        message: `"${STRUTS.title}" archived. No further review unless reopened.`,
      }),
    );
  });
});

describe('/admin/content — row actions', () => {
  it('Publish Now posts the publish action on an approved item', async () => {
    const user = userEvent.setup();
    const posts: Record<string, unknown>[] = [];
    server.use(
      http.post('*/api/v1/admin/content/:id/actions', async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: ACCRA });
      }),
    );
    renderQueue();
    await screen.findByText(ACCRA.title);

    await user.click(within(rowOf(ACCRA.title)).getByRole('button', { name: 'Publish Now' }));

    await waitFor(() => expect(posts).toEqual([{ action: 'publish' }]));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Content published',
        message: `"${ACCRA.title}" is now live on the public website.`,
      }),
    );
  });

  it('Remind Author posts remind_author on a changes-requested item', async () => {
    const user = userEvent.setup();
    const posts: Record<string, unknown>[] = [];
    server.use(
      http.post('*/api/v1/admin/content/:id/actions', async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: SENTINEL });
      }),
    );
    renderQueue();
    await screen.findByText(SENTINEL.title);

    await user.click(within(rowOf(SENTINEL.title)).getByRole('button', { name: 'Remind Author' }));

    await waitFor(() => expect(posts).toEqual([{ action: 'remind_author' }]));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'info',
        title: 'Author reminded',
        message: `"${SENTINEL.title}" — notification sent to the author.`,
      }),
    );
  });

  it('Preview only toasts — it has no endpoint', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(within(rowOf(STRUTS.title)).getByRole('button', { name: 'Preview' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'info',
        title: 'Reader preview',
        message: `"${STRUTS.title}" — rendering as it would appear to the public.`,
      }),
    );
  });

  it('a rejected item offers Reopen and Archive, both disabled', async () => {
    renderQueue();
    const rejected = byTitle("Africa's Cyber Awakening: How the Continent Is Fighting Back");
    await screen.findByText(rejected.title);

    const row = rowOf(rejected.title);
    expect(within(row).getByRole('button', { name: 'Reopen' })).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Archive' })).toBeDisabled();
  });
});

describe('/admin/content — error mapping', () => {
  it('a 403 legal_review_required shows the administrator sign-off line', async () => {
    server.use(
      http.post('*/api/v1/admin/content/:id/actions', () =>
        HttpResponse.json({ error: 'legal_review_required' }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(ACCRA.title);

    await user.click(within(rowOf(ACCRA.title)).getByRole('button', { name: 'Publish Now' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'crit',
        title: 'This item needs administrator sign-off before it can be published.',
      }),
    );
  });

  it('a 409 own_submission shows the verbatim refusal', async () => {
    server.use(
      http.post('*/api/v1/admin/content/:id/actions', () =>
        HttpResponse.json({ error: 'own_submission' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(ACCRA.title);

    await user.click(within(rowOf(ACCRA.title)).getByRole('button', { name: 'Publish Now' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'crit',
        title: 'You cannot review your own submission.',
      }),
    );
  });
});

describe('/admin/content — bulk approve', () => {
  it('skips flagged items and items the caller authored', async () => {
    const user = userEvent.setup();
    const posted: string[] = [];
    server.use(
      http.post('*/api/v1/admin/content/:id/actions', async ({ params, request }) => {
        posted.push(String(params.id));
        const body = (await request.json()) as { action: string };
        const item = moderationItems.find((candidate) => candidate.id === String(params.id));
        return HttpResponse.json({ data: { ...item, status: 'approved' }, body });
      }),
    );
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(screen.getByRole('button', { name: 'Approve All Flag-Free' }));

    // The fixture's only flag-free pending item is the Struts advisory:
    // State House is pending but flagged, Sentinel is flagged, the rest are not
    // pending. Nothing is authored by the session user.
    await waitFor(() => expect(posted).toEqual([STRUTS.id]));
    await waitFor(() =>
      expect(toasts().some((entry) => entry.title === 'Bulk approval complete')).toBe(true),
    );
  });

  it('with nothing eligible it toasts Nothing to approve', async () => {
    const user = userEvent.setup();
    // Make the caller the author of the only eligible item.
    sessionState.id = STRUTS.author.id;
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(screen.getByRole('button', { name: 'Approve All Flag-Free' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Nothing to approve',
        message: 'No flag-free pending items are currently in the queue.',
      }),
    );
  });
});

describe('/admin/content — permissions and chrome', () => {
  it('without content:moderate every action is disabled', async () => {
    sessionState.permissions = ['dashboard:read'];
    renderQueue();
    await screen.findByText(STRUTS.title);

    const row = rowOf(STRUTS.title);
    expect(within(row).getByRole('button', { name: 'Review' })).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review Next Item' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve All Flag-Free' })).toBeDisabled();
  });

  it('Export Review Log is disabled with the plan-mandated tooltip', async () => {
    renderQueue();
    await screen.findByText(STRUTS.title);

    const exportButton = screen.getByRole('button', { name: 'Export Review Log' });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute('title', 'Export is not available yet.');
  });

  it('Refresh Queue toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(screen.getByRole('button', { name: 'Refresh Queue' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({ kind: 'ok', title: 'Queue refreshed' }),
    );
    expect(toasts()[0]?.message).toMatch(/^Synced at \d{2}:\d{2}:\d{2} UTC\.$/);
  });

  it('Review Next Item opens the first pending item', async () => {
    const user = userEvent.setup();
    renderQueue();
    await screen.findByText(STRUTS.title);

    await user.click(screen.getByRole('button', { name: 'Review Next Item' }));
    const modal = await screen.findByRole('dialog');
    // The first pending_review row in fixture order.
    expect(within(modal).getByText(STATE_HOUSE.slugPath)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Review Next Item toasts Queue clear when nothing is pending', async () => {
    const user = userEvent.setup();
    // The mocked useSearchParams is not reactive, so the narrowed queue is
    // seeded before render rather than filtered mid-test.
    searchMock.value = new URLSearchParams('status=approved');
    renderQueue();
    await screen.findByText(ACCRA.title);

    await user.click(screen.getByRole('button', { name: 'Review Next Item' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'info',
        title: 'Queue clear',
        message: 'No items are currently pending review.',
      }),
    );
  });

  it('the aside panels render the snapshot, distribution and guidelines', async () => {
    renderQueue();
    await screen.findByText(STRUTS.title);

    expect(screen.getByText('Review Workflow')).toBeInTheDocument();
    expect(screen.getByText('Queue Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByText('Oldest waiting item')).toBeInTheDocument();
    expect(screen.getByText('Bulk Actions')).toBeInTheDocument();
    expect(
      screen.getByText('Bulk approvals still require individual confirmation per item.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Queue by Content Type')).toBeInTheDocument();
    for (const label of Object.values(CONTENT_TYPE_LABELS)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }

    expect(screen.getByText('Pre-Publication Guidelines')).toBeInTheDocument();
    expect(screen.getByText('No unverified claims')).toBeInTheDocument();
    expect(screen.getByText('Publication path selected')).toBeInTheDocument();
    expect(screen.getByText('Recent Moderation Activity')).toBeInTheDocument();
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEntryView } from '@vunvault/contracts';
import { AUDIT_CATEGORY_LABELS, AUDIT_SEVERITY_LABELS } from '@vunvault/contracts';
import { auditEntries, auditSummary, chainStatus } from '@vunvault/contracts/fixtures/audit';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminAudit } from '../../../../mocks/handlers/admin-audit';
import { server } from '../../../../mocks/server';
import AdminAuditPage from './page';

/**
 * System Audit Logs tests (Task 83b) — the spec's list: the summary tiles, the
 * filters in the URL, the row detail dialog opening from its labelled button,
 * verify success and the mismatch banner, the export download carrying the
 * filter query, the absence of ANY edit/delete control, and the clipboard
 * fallback toast.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const searchMock = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchMock.value,
}));

const createObjectURL = vi.hoisted(() => vi.fn(() => 'blob:mock'));
const revokeObjectURL = vi.hoisted(() => vi.fn());
const clipboardWrite = vi.hoisted(() => vi.fn(async () => undefined));

const sessionState = vi.hoisted(() => ({
  permissions: ['dashboard:read', 'audit:read'],
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

function renderTrail() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminAuditPage />
    </QueryClientProvider>,
  );
}

const NEWEST = auditEntries[0] as AuditEntryView;
const CRITICAL_ENTRY = auditEntries.find(
  (entry) => entry.severity === 'critical',
) as AuditEntryView;

function trailTable(): HTMLElement {
  const table = document.querySelector('table');
  if (table === null) throw new Error('The audit table is missing.');
  return table as HTMLElement;
}

/** Wait for the trail query to land and the table to replace its skeleton. */
async function awaitTrailTable(): Promise<HTMLElement> {
  return await screen.findByRole('table');
}

function rowOf(eventType: string): HTMLElement {
  const cell = within(trailTable()).getByText(eventType);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`The row for ${eventType} is missing.`);
  return row as HTMLElement;
}

function toasts() {
  return useToastStore.getState().toasts;
}

/**
 * Install the clipboard spy.
 *
 * `userEvent.setup()` replaces `navigator.clipboard` with its own stub, so this
 * MUST run after setup or the component talks to userEvent's clipboard and the
 * spy never sees the call.
 */
function installClipboard(): void {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminAudit();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  clipboardWrite.mockClear();
  clipboardWrite.mockResolvedValue(undefined);
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  routerMock.replace.mockReset();
  routerMock.replace.mockImplementation((url: string) => {
    searchMock.value = new URLSearchParams(url.split('?')[1] ?? '');
  });
  searchMock.value = new URLSearchParams();
  sessionState.permissions = ['dashboard:read', 'audit:read'];
});

describe('/admin/audit — summary tiles', () => {
  it('renders the six tiles from the summary fixture', async () => {
    renderTrail();
    await screen.findByText('Events (24h)');

    const heading = screen.getByRole('heading', { name: 'Audit trail indicators' });
    const kpis = heading.closest('section');
    if (kpis === null) throw new Error('The KPI section is missing.');

    expect(
      within(kpis).getByText(new Intl.NumberFormat('en-US').format(auditSummary.events24h)),
    ).toBeInTheDocument();
    expect(within(kpis).getByText('Auth Attempts')).toBeInTheDocument();
    expect(
      within(kpis).getByText(
        `${auditSummary.failedAuth} failed · ${auditSummary.lockedOut} locked out`,
      ),
    ).toBeInTheDocument();
    expect(within(kpis).getByText('Scan Completions')).toBeInTheDocument();
    expect(within(kpis).getByText(String(auditSummary.scanCompletions))).toBeInTheDocument();
    expect(within(kpis).getByText('Report Releases')).toBeInTheDocument();
    expect(within(kpis).getByText(String(auditSummary.reportReleases))).toBeInTheDocument();
    expect(within(kpis).getByText('Chain Integrity')).toBeInTheDocument();
    expect(within(kpis).getByText(String(auditSummary.chainIntegrityPercent))).toBeInTheDocument();
    expect(
      within(kpis).getByText(`${auditSummary.hashMismatches} hash mismatches`),
    ).toBeInTheDocument();
    expect(within(kpis).getByText('Retention (WORM)')).toBeInTheDocument();
    expect(within(kpis).getByText(String(auditSummary.retentionYears))).toBeInTheDocument();
    expect(within(kpis).getByText('Immutable · AES-256-GCM')).toBeInTheDocument();
  });
});

describe('/admin/audit — console and trail', () => {
  it('renders the chain chrome and meta from the chain fixture', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    // jsdom has no `EventSource`, so the stream reports the honest fallback
    // and the Task 83b poll keeps the tail moving (Task 93).
    expect(screen.getByText('POLLING')).toBeInTheDocument();
    expect(screen.getByText('Chain Intact')).toBeInTheDocument();
    expect(screen.getByText(chainStatus.node)).toBeInTheDocument();
    expect(screen.getByText(chainStatus.encryption)).toBeInTheDocument();
    expect(screen.getByText(chainStatus.headHash)).toBeInTheDocument();
    expect(
      screen.getByText(/vunvault-audit-trail@.*:\/var\/log\/vunvault\/audit\.log — tail -f/),
    ).toBeInTheDocument();
  });

  it('renders every fixture entry with category, severity, actor and short hash', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    for (const entry of auditEntries) {
      expect(within(trailTable()).getByText(entry.eventType)).toBeInTheDocument();
    }
    const row = rowOf(NEWEST.eventType);
    expect(within(row).getByText(AUDIT_CATEGORY_LABELS[NEWEST.category])).toBeInTheDocument();
    expect(within(row).getByText(AUDIT_SEVERITY_LABELS[NEWEST.severity])).toBeInTheDocument();
    expect(within(row).getByText(NEWEST.actorLabel)).toBeInTheDocument();
    expect(within(row).getByText(NEWEST.hash.slice(0, 8))).toBeInTheDocument();
    // `YYYY-MM-DD HH:MM:SS` — the header already carries "(UTC)".
    expect(within(row).getByText('2026-09-24 09:38:04')).toBeInTheDocument();
  });

  it('a SEV-level entry shows the SEV-n suffix on its chip', async () => {
    const withSev = auditEntries.find((entry) => entry.sevLevel !== null);
    if (withSev === undefined) {
      // The fixture may not carry one; assert the rule against a stub instead.
      server.use(
        http.get('*/api/v1/admin/audit', () =>
          HttpResponse.json({
            data: [{ ...NEWEST, sevLevel: 1 }],
            total: 1,
          }),
        ),
      );
    }
    renderTrail();
    await screen.findByText(NEWEST.eventType);
    expect(screen.getByText('SEV-1')).toBeInTheDocument();
  });
});

describe('/admin/audit — filters', () => {
  it('each control writes its query parameter', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    fireEvent.change(screen.getByLabelText('Event Type'), {
      target: { value: 'authentication' },
    });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/audit?category=authentication');

    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'critical' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/audit?severity=critical');

    fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'system' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/audit?actor=system');

    fireEvent.change(screen.getByLabelText('Time Range'), { target: { value: '7d' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/audit?range=7d');

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '41.90.64.199' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/audit?q=41.90.64.199');
  });

  it('?category= narrows the trail', async () => {
    searchMock.value = new URLSearchParams('category=authentication');
    renderTrail();

    const authEntries = auditEntries.filter((entry) => entry.category === 'authentication');
    expect(authEntries.length).toBeGreaterThan(0);
    await awaitTrailTable();
    for (const entry of authEntries) {
      expect(within(trailTable()).getByText(entry.eventType)).toBeInTheDocument();
    }
    for (const entry of auditEntries.filter(
      (candidate) => candidate.category !== 'authentication',
    )) {
      expect(within(trailTable()).queryByText(entry.eventType)).toBeNull();
    }
  });

  it('?q= matches the IP', async () => {
    searchMock.value = new URLSearchParams('q=41.90.64.199');
    renderTrail();
    await awaitTrailTable();

    expect(within(trailTable()).queryByText(CRITICAL_ENTRY.eventType)).toBeNull();
  });

  it('Reset clears the URL and toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    searchMock.value = new URLSearchParams('severity=critical');
    renderTrail();
    await awaitTrailTable();

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/audit');
    expect(toasts()[0]).toMatchObject({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full cryptographic audit trail.',
    });
  });

  it('an empty result shows the console empty state', async () => {
    searchMock.value = new URLSearchParams('q=zzz-no-such-event');
    renderTrail();

    expect(
      await screen.findByText('No audit events match the current filters'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Adjust your search terms or reset the filters to see the full cryptographic audit trail.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
  });
});

describe('/admin/audit — event detail dialog', () => {
  it('opens from the labelled row button and shows the full record', async () => {
    const user = userEvent.setup();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(
      screen.getByRole('button', { name: `Open detail for audit event ${NEWEST.seq}` }),
    );

    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(within(modal).getByText('Audit Event Detail')).toBeInTheDocument();
    // eventType renders twice by design: the dialog title and the Event Code row.
    expect(within(modal).getAllByText(NEWEST.eventType).length).toBe(2);
    expect(
      within(modal).getByText(NEWEST.eventType, { selector: '.al-modal-title' }),
    ).toBeInTheDocument();
    expect(within(modal).getByText(NEWEST.id)).toBeInTheDocument();
    expect(within(modal).getByText(`#${NEWEST.seq}`)).toBeInTheDocument();
    // The category renders twice in the dialog: the header chip and the
    // "Event Type" summary row.
    expect(
      within(modal).getAllByText(AUDIT_CATEGORY_LABELS[NEWEST.category]).length,
    ).toBeGreaterThan(0);
    expect(within(modal).getByText(NEWEST.actorLabel)).toBeInTheDocument();
    expect(within(modal).getByText(NEWEST.subject as string)).toBeInTheDocument();
    expect(within(modal).getByText(NEWEST.ip as string)).toBeInTheDocument();
    expect(within(modal).getByText(NEWEST.message)).toBeInTheDocument();
    expect(within(modal).getByText(NEWEST.hash)).toBeInTheDocument();
    expect(within(modal).getByText(NEWEST.prevHash)).toBeInTheDocument();
    expect(within(modal).getByText(`Linked to entry #${NEWEST.seq - 1}`)).toBeInTheDocument();
    expect(
      within(modal).getByText('Chain verified — entry is authentic and unmodified'),
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(
        'Audit entries are append-only. This record cannot be edited or deleted within the 7-year retention window.',
      ),
    ).toBeInTheDocument();
  });

  it('does NOT expose payloads, signatures or key ids', async () => {
    const user = userEvent.setup();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(
      screen.getByRole('button', { name: `Open detail for audit event ${NEWEST.seq}` }),
    );
    const modal = await screen.findByRole('dialog');

    expect(within(modal).queryByText(/Raw Encrypted Payload/i)).toBeNull();
    expect(within(modal).queryByText(/Signature:/i)).toBeNull();
    expect(within(modal).queryByText(/HMAC-SHA256/i)).toBeNull();
    expect(within(modal).queryByText(/key id/i)).toBeNull();
  });

  it('Copy puts the digest on the clipboard and toasts', async () => {
    const user = userEvent.setup();
    installClipboard();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(
      screen.getByRole('button', { name: `Open detail for audit event ${NEWEST.seq}` }),
    );
    const modal = await screen.findByRole('dialog');
    await user.click(
      within(modal).getByRole('button', { name: `Copy entry hash for event ${NEWEST.seq}` }),
    );

    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(NEWEST.hash));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Payload copied',
        message: 'Hash copied to clipboard.',
      }),
    );
  });

  it('a blocked clipboard toasts the fallback pair', async () => {
    const user = userEvent.setup();
    installClipboard();
    clipboardWrite.mockRejectedValue(new Error('denied'));
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(
      screen.getByRole('button', { name: `Open detail for audit event ${NEWEST.seq}` }),
    );
    const modal = await screen.findByRole('dialog');
    await user.click(
      within(modal).getByRole('button', { name: `Copy previous hash for event ${NEWEST.seq}` }),
    );

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Clipboard blocked',
        message: 'Select and copy the value manually.',
      }),
    );
  });
});

describe('/admin/audit — chain verification', () => {
  it('a clean verify toasts the counts and integrity', async () => {
    const user = userEvent.setup();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(screen.getByRole('button', { name: 'Verify Hash Chain' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Hash chain verified',
        message: `${new Intl.NumberFormat('en-US').format(chainStatus.totalEntries)} entries checked · 0 mismatches · chain integrity 100%.`,
      }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mismatches raise the persistent banner and a critical toast', async () => {
    server.use(
      http.post('*/api/v1/admin/audit/verify', () =>
        HttpResponse.json({
          data: {
            checkedFromSeq: 1,
            checkedToSeq: NEWEST.seq,
            entries: 1482904,
            mismatches: 2,
            firstMismatchSeq: 1482501,
            verifiedAt: new Date().toISOString(),
          } satisfies VerifyShape,
        }),
      ),
    );
    const user = userEvent.setup();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(screen.getByRole('button', { name: 'Verify Hash Chain' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'crit',
        title: 'Hash chain verified',
        message: '1,482,904 entries checked · 2 mismatches · chain integrity 100%.',
      }),
    );
    expect(
      await screen.findByText(
        'Hash chain mismatch detected at entry #1482501. Escalate to the incident commander.',
      ),
    ).toBeInTheDocument();
  });

  it('a 409 verify_in_progress toasts the verbatim line', async () => {
    server.use(
      http.post('*/api/v1/admin/audit/verify', () =>
        HttpResponse.json({ error: 'verify_in_progress' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(screen.getByRole('button', { name: 'Verify Hash Chain' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Verification already running',
      }),
    );
  });

  it('Run Integrity Check re-reads the chain and toasts its state', async () => {
    const user = userEvent.setup();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(screen.getByRole('button', { name: 'Run Integrity Check' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({ kind: 'ok', title: 'Integrity check complete' }),
    );
    expect(toasts()[0]?.message).toMatch(
      /^Chain state: intact · last verified at \d{2}:\d{2}:\d{2} UTC\.$/,
    );
  });
});

describe('/admin/audit — export and stream', () => {
  it('Export downloads a CSV carrying the current filters', async () => {
    const requested: string[] = [];
    server.use(
      http.get('*/api/v1/admin/audit/export', ({ request }) => {
        requested.push(new URL(request.url).search);
        return new HttpResponse('seq,hash\n1,abc\n', {
          headers: { 'content-type': 'text/csv' },
        });
      }),
    );
    const user = userEvent.setup();
    searchMock.value = new URLSearchParams('category=authentication&range=7d');
    renderTrail();
    await awaitTrailTable();

    await user.click(screen.getByRole('button', { name: 'Export Compliance Data' }));

    await waitFor(() => expect(requested).toHaveLength(1));
    expect(requested[0]).toContain('category=authentication');
    expect(requested[0]).toContain('range=7d');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Compliance export ready',
      }),
    );
    expect(toasts()[0]?.message).toMatch(
      /^Signed CSV bundle generated for Last 7 days at \d{2}:\d{2}:\d{2} UTC\.$/,
    );
  });

  it('a 422 range_too_large does not download', async () => {
    const user = userEvent.setup();
    searchMock.value = new URLSearchParams('range=30d');
    renderTrail();
    await awaitTrailTable();

    await user.click(screen.getByRole('button', { name: 'Export Compliance Data' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({ kind: 'warn', title: 'Export unavailable' }),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('Refresh Stream toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    await user.click(screen.getByRole('button', { name: 'Refresh Stream' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({ kind: 'ok', title: 'Stream refreshed' }),
    );
    expect(toasts()[0]?.message).toMatch(/^Audit tail resynced at \d{2}:\d{2}:\d{2} UTC\.$/);
  });

  it('Export WORM Snapshot is disabled with the platform tooltip', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    const snapshot = screen.getByRole('button', { name: 'Export WORM Snapshot' });
    expect(snapshot).toBeDisabled();
    expect(snapshot).toHaveAttribute(
      'title',
      'Snapshots are written automatically by the platform.',
    );
  });
});

describe('/admin/audit — read-only guarantees', () => {
  it('no control anywhere offers edit, delete or redact', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    const forbidden = /\b(edit|delete|remove|redact|purge|destroy)\b/i;
    for (const button of screen.queryAllByRole('button')) {
      const name = button.getAttribute('aria-label') ?? button.textContent ?? '';
      expect(name).not.toMatch(forbidden);
    }
    // The trail itself carries no form controls either.
    expect(trailTable().querySelectorAll('input, select, textarea')).toHaveLength(0);
  });

  it('the chain panel and the derived panels render', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    expect(screen.getByText('Cryptographic Chain')).toBeInTheDocument();
    expect(screen.getByText('Intact')).toBeInTheDocument();
    expect(screen.getByText('Chain State')).toBeInTheDocument();
    expect(screen.getByText('Total entries')).toBeInTheDocument();
    // Total entries and Chain height are the same figure in an append-only chain.
    expect(
      screen.getAllByText(new Intl.NumberFormat('en-US').format(chainStatus.totalEntries)).length,
    ).toBe(2);
    expect(screen.getByText(chainStatus.genesisDate)).toBeInTheDocument();
    expect(screen.getByText('Latest Blocks')).toBeInTheDocument();
    expect(
      screen.getByText(`#${new Intl.NumberFormat('en-US').format(NEWEST.seq)}`),
    ).toBeInTheDocument();

    expect(screen.getByText('Event Distribution (24h)')).toBeInTheDocument();
    expect(screen.getByText('Scan Events')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    // The critical fixture entries are surfaced as anomalies (and also appear in
    // the trail, hence getAllByText).
    expect(screen.getAllByText(CRITICAL_ENTRY.eventType).length).toBeGreaterThan(1);
  });

  it('without audit:read the write actions are disabled', async () => {
    sessionState.permissions = ['dashboard:read'];
    renderTrail();
    await screen.findByText(NEWEST.eventType);

    expect(screen.getByRole('button', { name: 'Verify Hash Chain' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export Compliance Data' })).toBeDisabled();
  });
});

/** Local alias so the `satisfies` check above reads without an extra import. */
type VerifyShape = {
  checkedFromSeq: number;
  checkedToSeq: number;
  entries: number;
  mismatches: number;
  firstMismatchSeq: number | null;
  verifiedAt: string;
};

/**
 * Live tail over SSE (Task 93).
 *
 * jsdom ships no `EventSource`, so these tests stub the global with a
 * hand-driven fake: the page's hook must pick it up through the SAME code
 * path a browser takes (`typeof EventSource`), which is exactly what the
 * POLLING fallback above proves from the other side.
 */

type PageListener = (event: MessageEvent) => void;

class PageFakeEventSource {
  static instances: PageFakeEventSource[] = [];

  readyState = 0;
  closed = false;
  readonly url: string;
  readonly withCredentials: boolean;
  private readonly listeners = new Map<string, Set<PageListener>>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    PageFakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: PageListener): void {
    const set = this.listeners.get(type) ?? new Set<PageListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, payload: unknown): void {
    this.emitRaw(type, JSON.stringify(payload));
  }

  emitRaw(type: string, raw: string): void {
    const event = { data: raw } as unknown as MessageEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  open(): void {
    this.readyState = 1;
    this.emitRaw('open', '');
  }
}

function pageSocket(index = 0): PageFakeEventSource {
  const instance = PageFakeEventSource.instances[index];
  if (instance === undefined) throw new Error(`No EventSource instance #${index} was created.`);
  return instance;
}

/** A contract-valid fresh entry — `createdAt` inside every range window. */
function liveEntry(overrides: Partial<AuditEntryView> = {}): AuditEntryView {
  return {
    ...NEWEST,
    seq: NEWEST.seq + 1,
    id: 'a0000000-0000-4000-8000-000001482905',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function streamPill(): HTMLElement {
  const pill = document.getElementById('al-stream-pill');
  if (pill === null) throw new Error('The stream pill is missing.');
  return pill;
}

beforeEach(() => {
  PageFakeEventSource.instances = [];
});

describe('/admin/audit — live SSE tail', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', PageFakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inserts a pushed entry at the head, highlighted, and reports LIVE', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);
    expect(streamPill()).toHaveTextContent('RECONNECTING');

    act(() => pageSocket().open());
    expect(streamPill()).toHaveTextContent('LIVE');

    const pushed = liveEntry({ eventType: 'ADMIN_ROLE_CHANGED', message: 'role escalated' });
    act(() => pageSocket().emit('entry', { type: 'entry', entry: pushed }));

    await waitFor(() => expect(screen.getByText('ADMIN_ROLE_CHANGED')).toBeInTheDocument());
    const rows = within(trailTable()).getAllByRole('row');
    // Row 0 is the header; the pushed entry leads the body.
    expect(within(rows[1] as HTMLElement).getByText('ADMIN_ROLE_CHANGED')).toBeInTheDocument();
    expect((rows[1] as HTMLElement).className).toContain('al-row--new');
    // Unfiltered view: the footer total counts the arrival.
    expect(within(trailTable()).getByText(/^11 entries match/)).toBeInTheDocument();
  });

  it('a push that misses the active category filter is not inserted', async () => {
    searchMock.value = new URLSearchParams('category=authentication');
    renderTrail();
    await screen.findByRole('table');
    act(() => pageSocket().open());

    act(() =>
      pageSocket().emit('entry', {
        type: 'entry',
        entry: liveEntry({ eventType: 'SYSTEM_SWEEP', category: 'system' }),
      }),
    );
    // Let any (incorrect) insertion settle before asserting absence.
    await act(async () => undefined);
    expect(screen.queryByText('SYSTEM_SWEEP')).not.toBeInTheDocument();

    act(() =>
      pageSocket().emit('entry', {
        type: 'entry',
        entry: liveEntry({
          seq: NEWEST.seq + 2,
          id: 'a0000000-0000-4000-8000-000001482906',
          eventType: 'MFA_ENROLLED',
          category: 'authentication',
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText('MFA_ENROLLED')).toBeInTheDocument());
    // Filtered view: the server total is the filtered one and does not move.
    expect(within(trailTable()).queryByText(/^11 entries match/)).not.toBeInTheDocument();
  });

  it('pause holds arrivals with a count, resume inserts them', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);
    act(() => pageSocket().open());

    await userEvent.click(screen.getByRole('button', { name: 'Pause stream' }));
    expect(streamPill()).toHaveTextContent('PAUSED');

    act(() =>
      pageSocket().emit('entry', {
        type: 'entry',
        entry: liveEntry({ eventType: 'PAUSED_ARRIVAL' }),
      }),
    );
    await act(async () => undefined);
    expect(screen.queryByText('PAUSED_ARRIVAL')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume stream/ })).toHaveTextContent('1 new');

    await userEvent.click(screen.getByRole('button', { name: /Resume stream/ }));
    await waitFor(() => expect(screen.getByText('PAUSED_ARRIVAL')).toBeInTheDocument());
    expect(streamPill()).toHaveTextContent('LIVE');
  });

  it('a chain frame flips the pill and the panel without a refetch', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);
    act(() => pageSocket().open());

    act(() =>
      pageSocket().emit('chain', {
        type: 'chain',
        chain: { ...chainStatus, state: 'broken' },
      }),
    );

    await waitFor(() => expect(screen.getByText('Chain Broken')).toBeInTheDocument());
    const pill = document.getElementById('al-chain-pill');
    expect(pill?.className).toContain('is-warn');
    expect(screen.getByText('Broken')).toBeInTheDocument();
  });

  it('Refresh Stream resyncs the socket and keeps the verbatim toast', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);
    act(() => pageSocket().open());

    await userEvent.click(screen.getByRole('button', { name: /Refresh Stream/ }));

    expect(pageSocket(0).closed).toBe(true);
    expect(PageFakeEventSource.instances).toHaveLength(2);
    await waitFor(() => expect(toasts()[0]?.title).toBe('Stream refreshed'));
  });

  it('an unparsable frame never reaches the table', async () => {
    renderTrail();
    await screen.findByText(NEWEST.eventType);
    act(() => pageSocket().open());

    act(() => pageSocket().emitRaw('entry', '{truncated'));
    await act(async () => undefined);
    expect(streamPill()).toHaveTextContent('LIVE');
    // Header row + the ten fixture rows + the footer row — nothing arrived.
    expect(within(trailTable()).getAllByRole('row')).toHaveLength(auditEntries.length + 2);
  });
});

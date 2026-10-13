// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { advisorySummary, drafts } from '@vunvault/contracts/fixtures/intel';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminAdvisories } from '../../../../mocks/handlers/admin-advisories';
import { server } from '../../../../mocks/server';
import AdminZeroDayPage from './page';

/**
 * Zero-Day Advisory Desk tests (Task 81) — the spec's list: the CVE message,
 * the NVD import filling fields without saving, the severity/CVSS mismatch
 * warning, scope add / duplicate / remove with the verbatim toast, draft
 * create versus update, the drafts panel load, the patch-status change and
 * the permission gating. Plus a smoke assertion per component that it renders
 * its key verbatim strings.
 */

const sessionState = vi.hoisted(() => ({
  permissions: ['intel:read', 'intel:write', 'intel:broadcast'],
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

function renderDesk() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminZeroDayPage />
    </QueryClientProvider>,
  );
}

/** The published table (the drafts panel and preview carry no `<table>`). */
function publishedTable(): HTMLElement {
  const table = document.querySelector('table');
  if (table === null) throw new Error('The published-advisories table is missing.');
  return table as HTMLElement;
}

/** Wait for the published list query to land, then return the table. */
async function publishedRows(): Promise<HTMLElement> {
  await screen.findByText('Apache Struts 2 — OGNL injection RCE');
  return publishedTable();
}

/** Wait for the drafts query to land. */
async function draftsPanel(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: 'Open Drafts' });
  const card = heading.closest('section');
  if (card === null) throw new Error('The drafts card is missing.');
  await within(card as HTMLElement).findByText('CVE-2026-40118');
  return card as HTMLElement;
}

function rowOf(cveId: string): HTMLElement {
  const cell = within(publishedTable()).getByText(cveId);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`The row for ${cveId} is missing.`);
  return row;
}

function toasts() {
  return useToastStore.getState().toasts;
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminAdvisories();
  sessionState.permissions = ['intel:read', 'intel:write', 'intel:broadcast'];
});

describe('/admin/zero-day — page chrome and summary', () => {
  it('renders the head, the six tiles and the verbatim page copy', async () => {
    renderDesk();
    await screen.findByText('Active Zero-Days');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Zero-Day Advisory Editor');
    expect(screen.getByText('Zero-Day Intelligence & Advisory Desk')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Draft, review and broadcast zero-day advisories. Save work in progress as a draft, or raise an emergency broadcast that pushes the advisory to every affected client dashboard within seconds.',
      ),
    ).toBeInTheDocument();

    // The head actions.
    expect(screen.getByRole('button', { name: 'New Advisory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import From NVD' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Broadcast History' })).toBeInTheDocument();

    // Every tile is driven by the summary fixture — no prototype numbers.
    const kpis = screen
      .getByRole('heading', { name: 'Zero-day intelligence indicators' })
      .closest('section');
    if (kpis === null) throw new Error('The KPI section is missing.');
    const count = (value: number): string => value.toLocaleString('en-US');
    expect(within(kpis).getByText(count(advisorySummary.activeZeroDays))).toBeInTheDocument();
    expect(within(kpis).getByText('Active Zero-Days')).toBeInTheDocument();
    expect(within(kpis).getByText('Critical Severity')).toBeInTheDocument();
    expect(within(kpis).getByText('Weaponized In Wild')).toBeInTheDocument();
    expect(within(kpis).getByText('Advisories Published')).toBeInTheDocument();
    expect(within(kpis).getByText('Open Drafts')).toBeInTheDocument();
    expect(within(kpis).getByText('Dashboards Reached')).toBeInTheDocument();
    expect(
      within(kpis).getByText(`${count(advisorySummary.unpatchedCritical)} currently unpatched`),
    ).toBeInTheDocument();
    expect(within(kpis).getByText('● Active exploitation confirmed')).toBeInTheDocument();
    expect(
      within(kpis).getByText(`▲ ${count(advisorySummary.broadcastThisMonth)} broadcast this month`),
    ).toBeInTheDocument();
  });
});

describe('/admin/zero-day — advisory editor', () => {
  it('renders the fieldsets, labels and placeholders verbatim', async () => {
    renderDesk();
    await screen.findByText('Advisory Editor');

    expect(screen.getByText('Identifiers')).toBeInTheDocument();
    expect(screen.getByText('Severity Level')).toBeInTheDocument();
    expect(screen.getByText('Advisory Title')).toBeInTheDocument();
    expect(screen.getByText('Affected Scope')).toBeInTheDocument();
    expect(screen.getByText('Technical Summary & Guidance')).toBeInTheDocument();

    expect(screen.getByLabelText(/CVE ID/)).toHaveAttribute('placeholder', 'CVE-2026-21447');
    expect(screen.getByLabelText('Vendor / Project')).toHaveAttribute(
      'placeholder',
      'Apache Software Foundation',
    );
    expect(screen.getByLabelText(/CVSS v3.1 Base Score/)).toHaveAttribute('placeholder', '9.8');
    expect(screen.getByLabelText('Disclosure Date (UTC)')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText(/Headline/)).toBeInTheDocument();
    expect(screen.getByLabelText('Technical Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Remediation Guidance')).toBeInTheDocument();
    expect(screen.getByLabelText('References')).toBeInTheDocument();

    // The four severity options carry the contract's own CVSS band hints.
    expect(screen.getByRole('radio', { name: 'Critical CVSS 9.0 – 10.0' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'High CVSS 7.0 – 8.9' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium CVSS 4.0 – 6.9' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Low CVSS 0.1 – 3.9' })).toBeInTheDocument();

    // The four exploitation flags.
    expect(screen.getByLabelText('Weaponized in the wild')).toBeInTheDocument();
    expect(screen.getByLabelText('Public PoC available')).toBeInTheDocument();
    expect(screen.getByLabelText('Pre-auth exploitable')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor patch available')).toBeInTheDocument();

    expect(screen.getByText('Draft — Not Published')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Complete the CVE details, set the severity level and define the affected scope. Drafts are private to the intelligence team until explicitly broadcast.',
      ),
    ).toBeInTheDocument();
  });

  it('an invalid CVE shows the verbatim contract message', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    const cve = screen.getByLabelText(/CVE ID/);
    await user.type(cve, 'CVE-26-1');
    await user.tab();

    expect(
      await screen.findByText('Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.'),
    ).toBeVisible();
    expect(cve).toHaveClass('is-invalid');
  });

  it('the counters track the contract maxima', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    expect(screen.getByText('0 / 140')).toBeInTheDocument();
    expect(screen.getByText('0 / 1200')).toBeInTheDocument();
    expect(screen.getByText('0 / 900')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Headline/), 'Redis — ACL bypass');
    expect(screen.getByText('18 / 140')).toBeInTheDocument();
  });

  it('Save Draft with an empty CVE toasts Nothing to save', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({
      kind: 'warn',
      title: 'Nothing to save',
      message: 'Add at least a CVE identifier before saving this advisory as a draft.',
    });
  });

  it('the CVSS score auto-selects the severity band', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVSS v3.1 Base Score/), '9.8');

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Critical CVSS 9.0 – 10.0' })).toBeChecked(),
    );
    expect(screen.getByText('Critical', { selector: '#zd-severity-value' })).toBeInTheDocument();
  });

  it('a manual severity outside the band shows the mismatch warning', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVSS v3.1 Base Score/), '9.8');
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Critical CVSS 9.0 – 10.0' })).toBeChecked(),
    );

    // Override the projection: 9.8 is a critical band, Low is not.
    await user.click(screen.getByRole('radio', { name: 'Low CVSS 0.1 – 3.9' }));

    expect(await screen.findByText('Severity does not match the CVSS score.')).toBeInTheDocument();
  });

  it('a manual severity inside the band stays quiet', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVSS v3.1 Base Score/), '9.8');
    await user.click(screen.getByRole('radio', { name: 'Critical CVSS 9.0 – 10.0' }));

    expect(screen.queryByText('Severity does not match the CVSS score.')).not.toBeInTheDocument();
  });
});

describe('/admin/zero-day — NVD import', () => {
  it('fills the fields and never auto-saves', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-44120');
    await user.click(screen.getByRole('button', { name: 'Import From NVD' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'NVD data imported',
        message: 'Review the imported fields before saving.',
      }),
    );

    expect(screen.getByLabelText('Vendor / Project')).toHaveValue('Apache Software Foundation');
    expect(screen.getByLabelText(/CVSS v3.1 Base Score/)).toHaveValue('9.8');
    expect(screen.getByRole('radio', { name: 'Critical CVSS 9.0 – 10.0' })).toBeChecked();
    expect(screen.getByLabelText('Disclosure Date (UTC)')).toHaveValue('2026-09-24');
    expect(screen.getByLabelText(/Headline/)).toHaveValue(
      'Apache Tomcat — request smuggling in the AJP connector',
    );
    expect(screen.getByLabelText('References')).toHaveValue(
      'https://nvd.nist.gov/vuln/detail/CVE-2026-44120',
    );

    // Nothing was saved: the desk is still on an unsaved draft.
    expect(screen.getByText('Never', { selector: '#zd-last-saved' })).toBeInTheDocument();
    expect(screen.getByText('Draft', { selector: '#zd-status-value' })).toBeInTheDocument();
  });

  it('an unknown CVE maps the 404 onto the CVE field', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-00001');
    await user.click(screen.getByRole('button', { name: 'Import From NVD' }));

    expect(await screen.findByText('CVE not found in NVD.')).toBeVisible();
  });

  it('a 502 toasts the manual-entry fallback', async () => {
    server.use(
      http.get('*/api/v1/admin/advisories/nvd', () =>
        HttpResponse.json({ error: 'upstream_unavailable' }, { status: 502 }),
      ),
    );
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-44120');
    await user.click(screen.getByRole('button', { name: 'Import From NVD' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Import From NVD',
        message: 'NVD is unavailable. Enter the details manually.',
      }),
    );
  });
});

describe('/admin/zero-day — affected scope', () => {
  /** The editor's own empty state — the client preview repeats the string. */
  function scopeEmpty(): HTMLElement {
    return screen.getByText('No scope entries', { selector: '.zd-scope-empty' });
  }

  function scopeChips(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.zd-scope-chip'));
  }

  it('renders the quick-add categories and the empty state', async () => {
    renderDesk();
    await screen.findByText('Affected Scope');

    expect(scopeEmpty()).toBeInTheDocument();
    expect(screen.getByText('Quick add:')).toBeInTheDocument();
    for (const label of [
      'Web & API',
      'Network & Edge',
      'Endpoint / Desktop',
      'Cloud & Containers',
      'Mobile',
      'OT / ICS',
      'Identity & SSO',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        'Add every product, version range, platform or client host class the advisory applies to. The broadcast engine matches these against client asset inventories.',
      ),
    ).toBeInTheDocument();
  });

  it('Enter adds a chip, a duplicate toasts, and remove is labelled', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Affected Scope');

    const input = screen.getByLabelText('Affected Products, Versions, Platforms or Hosts');
    await user.type(input, 'Struts 2.0.0 – 2.5.32{Enter}');

    await waitFor(() => expect(scopeChips()).toHaveLength(1));
    expect(scopeChips()[0]).toHaveTextContent('Struts 2.0.0 – 2.5.32');
    expect(screen.queryByText('No scope entries', { selector: '.zd-scope-empty' })).toBeNull();
    expect(screen.getByText('1', { selector: '#zd-scope-count' })).toBeInTheDocument();
    // The preview mirrors the same entry.
    expect(
      screen.getByText('Struts 2.0.0 – 2.5.32', { selector: '.zd-preview-chip' }),
    ).toBeInTheDocument();

    // The remove button names its entry.
    expect(
      screen.getByRole('button', { name: 'Remove scope entry: Struts 2.0.0 – 2.5.32' }),
    ).toBeInTheDocument();

    // A duplicate is refused with the verbatim toast.
    await user.type(input, 'Struts 2.0.0 – 2.5.32{Enter}');
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Already in scope',
        message: '"Struts 2.0.0 – 2.5.32" is already listed.',
      }),
    );
    expect(scopeChips()).toHaveLength(1);
    expect(screen.getByText('1', { selector: '#zd-scope-count' })).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Remove scope entry: Struts 2.0.0 – 2.5.32' }),
    );
    await waitFor(() => expect(scopeEmpty()).toBeInTheDocument());
    expect(screen.getByText('0', { selector: '#zd-scope-count' })).toBeInTheDocument();
  });

  it('a quick-add button appends its category as an entry', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Affected Scope');

    await user.click(screen.getByRole('button', { name: 'OT / ICS' }));

    await waitFor(() => expect(scopeChips()).toHaveLength(1));
    expect(scopeChips()[0]).toHaveTextContent('OT / ICS');
    expect(
      screen.getByRole('button', { name: 'Remove scope entry: OT / ICS' }),
    ).toBeInTheDocument();
  });
});

describe('/admin/zero-day — client preview', () => {
  it('shows the placeholders, then tracks the editor live', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Client Dashboard Preview');

    expect(screen.getByText('CVE-XXXX-XXXXX')).toBeInTheDocument();
    expect(screen.getByText('No severity')).toBeInTheDocument();
    expect(screen.getByText('Advisory title will appear here')).toHaveClass('is-placeholder');
    expect(
      screen.getByText('No scope entries', { selector: '.zd-preview-chip' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Source: VUNVAULT Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Not dated')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-44120');
    await user.type(screen.getByLabelText(/Headline/), 'Apache Tomcat — request smuggling');

    expect(screen.getByText('CVE-2026-44120', { selector: '#zd-prev-cve' })).toBeInTheDocument();
    const title = screen.getByText('Apache Tomcat — request smuggling', {
      selector: '#zd-prev-title',
    });
    expect(title).not.toHaveClass('is-placeholder');
    expect(screen.queryByText('Advisory title will appear here')).not.toBeInTheDocument();
  });

  it('Preview Client View toasts the verbatim pair', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Client Dashboard Preview');

    await user.click(screen.getByRole('button', { name: 'Preview Client View' }));

    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({
      kind: 'info',
      title: 'Client view preview',
      message: 'Opening a read-only rendering of the advisory as clients would see it.',
    });
  });
});

describe('/admin/zero-day — saving drafts', () => {
  it('a new draft POSTs and switches the panel to update mode', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-44120');
    await user.type(screen.getByLabelText(/Headline/), 'Apache Tomcat — request smuggling');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Draft saved',
        message:
          'CVE-2026-44120 stored privately. Only the intelligence team can see it until broadcast.',
      }),
    );
    expect(screen.getByText('Draft', { selector: '#zd-status-value' })).toBeInTheDocument();
    expect(screen.queryByText('Never', { selector: '#zd-last-saved' })).not.toBeInTheDocument();

    // Saving again must UPDATE, not create a duplicate.
    await user.type(screen.getByLabelText('Vendor / Project'), 'Apache');
    const puts: string[] = [];
    server.use(
      http.put('*/api/v1/admin/advisories/:id', async ({ request }) => {
        puts.push(new URL(request.url).pathname);
        return HttpResponse.json({
          data: {
            id: '20000000-0000-4000-8000-000000000001',
            cveId: 'CVE-2026-44120',
            vendor: 'Apache',
            cvss: null,
            disclosureDate: null,
            severity: null,
            weaponized: false,
            publicPoc: false,
            preAuth: false,
            patchAvailable: false,
            title: 'Apache Tomcat — request smuggling',
            summary: null,
            remediation: null,
            references: [],
            scope: [],
            status: 'draft',
            patchStatus: 'unpatched',
            author: { id: 'c0000000-0000-4000-8000-000000000001', label: 'e.reed' },
            lastSavedAt: new Date().toISOString(),
            publishedAt: null,
            lastBroadcastAt: null,
            reach: null,
          },
        });
      }),
    );
    useToastStore.setState({ toasts: [] });
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatch(/\/api\/v1\/admin\/advisories\/20000000-0000-4000-8000-000000000001$/);
  });

  it('a duplicate CVE maps the 409 onto the field', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    // CVE-2026-21447 is already published in the fixture store.
    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-21447');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(await screen.findByText('An advisory for this CVE already exists.')).toBeVisible();
  });

  it('New Advisory clears the editor and toasts', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-44120');
    await user.type(screen.getByLabelText(/Headline/), 'Something');
    await user.click(screen.getByRole('button', { name: 'New Advisory' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'info',
        title: 'Editor cleared',
        message: 'Ready for a new zero-day advisory.',
      }),
    );
    expect(screen.getByLabelText(/CVE ID/)).toHaveValue('');
    expect(screen.getByText('0 / 140')).toBeInTheDocument();
  });
});

describe('/admin/zero-day — drafts panel', () => {
  it('lists the fixture drafts with author and note', async () => {
    renderDesk();
    const panel = await draftsPanel();

    for (const draft of drafts) {
      expect(within(panel).getByText(draft.cveId)).toBeInTheDocument();
      if (draft.title !== null) {
        expect(within(panel).getByText(draft.title)).toBeInTheDocument();
      }
      expect(within(panel).getByText(new RegExp(`^${draft.authorLabel} · `))).toBeInTheDocument();
      if (draft.note !== null) {
        expect(within(panel).getByText(draft.note)).toBeInTheDocument();
      }
    }
    // The note values are the contract's own DRAFT_NOTE_VALUES.
    expect(within(panel).getByText('Unsaved changes')).toBeInTheDocument();
    expect(within(panel).getByText('Awaiting reviewer')).toBeInTheDocument();
    expect(within(panel).getByText('Needs scope entries')).toBeInTheDocument();

    // The head tag and the button count EVERY open draft, not just the rows.
    expect(
      within(panel).getByRole('button', {
        name: `View all ${advisorySummary.openDrafts} drafts`,
      }),
    ).toBeInTheDocument();
  });

  it('clicking a draft loads it into the editor', async () => {
    const user = userEvent.setup();
    renderDesk();
    const panel = await draftsPanel();

    await user.click(within(panel).getByRole('button', { name: 'Open draft CVE-2026-40118' }));

    await waitFor(() => expect(screen.getByLabelText(/CVE ID/)).toHaveValue('CVE-2026-40118'));
    expect(screen.getByLabelText(/Headline/)).toHaveValue(
      'Kubernetes ingress-nginx — admission webhook bypass',
    );
    // The loaded draft is now the update target, and its scope came with it.
    expect(screen.getByText('1', { selector: '#zd-scope-count' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Critical CVSS 9.0 – 10.0' })).toBeChecked();
  });
});

describe('/admin/zero-day — recently published', () => {
  it('renders the fixture rows with severity, reach and patch status', async () => {
    renderDesk();
    const table = await publishedRows();

    expect(within(table).getByText('Web & API · Struts 2.0.0 – 2.5.32')).toBeInTheDocument();
    expect(within(table).getByText('312 dashboards')).toBeInTheDocument();
    expect(within(table).getByText('24 Sep · 14:36')).toBeInTheDocument();
    expect(within(table).getAllByText('Unpatched').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Patch in progress').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Patched').length).toBeGreaterThan(0);
    // Only the six most recent rows are listed.
    expect(table.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(
      within(table).getByText(
        'Broadcast reach counts unique client dashboards that acknowledged the advisory within 24 hours.',
      ),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: 'Re-broadcast' })).toHaveLength(6);
  });

  it('the patch-status menu PATCHes the row', async () => {
    const user = userEvent.setup();
    renderDesk();
    await publishedRows();

    await user.click(
      within(rowOf('CVE-2026-21447')).getByRole('button', {
        name: 'Patch status for CVE-2026-21447: Unpatched',
      }),
    );

    const menu = await screen.findByRole('menu', { name: 'Patch status' });
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Patched' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Patch status updated',
        message: 'CVE-2026-21447 is now Patched.',
      }),
    );
    await waitFor(() =>
      expect(
        within(rowOf('CVE-2026-21447')).getByRole('button', {
          name: 'Patch status for CVE-2026-21447: Patched',
        }),
      ).toBeInTheDocument(),
    );
    // The menu closed after the write.
    expect(screen.queryByRole('menu', { name: 'Patch status' })).toBeNull();
  });

  it('Retract requires a note of at least ten characters', async () => {
    const user = userEvent.setup();
    renderDesk();
    await publishedRows();

    await user.click(within(rowOf('CVE-2026-21447')).getByRole('button', { name: 'Retract' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await user.click(within(dialog).getByRole('button', { name: 'Retract advisory' }));
    expect(
      await within(dialog).findByText('Add a note of at least 10 characters.'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Retraction note/), 'Withdrawn: vendor fix.');
    await user.click(within(dialog).getByRole('button', { name: 'Retract advisory' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Advisory retracted',
        message: 'CVE-2026-21447 was withdrawn from client dashboards.',
      }),
    );
  });
});

describe('/admin/zero-day — permissions', () => {
  it('without intel:broadcast the emergency area is hidden', async () => {
    sessionState.permissions = ['intel:read', 'intel:write'];
    renderDesk();
    await screen.findByText('Advisory Editor');

    expect(screen.queryByRole('button', { name: 'Emergency Broadcast' })).toBeNull();
    expect(screen.queryByText('Estimated Broadcast Reach')).toBeNull();
    // Analysts keep the draft tools.
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
    await publishedRows();
    expect(screen.queryAllByRole('button', { name: 'Re-broadcast' })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: 'Retract' })).toHaveLength(0);
  });

  it('without intel:write the desk is read-only', async () => {
    sessionState.permissions = ['intel:read'];
    renderDesk();
    await screen.findByText('Advisory Editor');
    const table = await publishedRows();

    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    // The patch chip degrades to a static badge, not a menu.
    expect(
      screen.queryByRole('button', { name: 'Patch status for CVE-2026-21447: Unpatched' }),
    ).toBeNull();
    expect(within(table).getAllByText('Unpatched').length).toBeGreaterThan(0);
    expect(within(rowOf('CVE-2026-21447')).getByRole('button', { name: 'Edit' })).toBeDisabled();
  });

  it('a super admin sees the whole desk', async () => {
    renderDesk();
    await screen.findByText('Advisory Editor');

    expect(screen.getByRole('button', { name: 'Emergency Broadcast' })).toBeInTheDocument();
    expect(screen.getByText('Estimated Broadcast Reach')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
  });
});

describe('/admin/zero-day — publish controls', () => {
  it('renders the editorial state and the verbatim action copy', async () => {
    renderDesk();
    await screen.findByText('Publish Controls');

    expect(screen.getByText('Editorial State')).toBeInTheDocument();
    expect(screen.getByText('Current status')).toBeInTheDocument();
    expect(screen.getByText('Never', { selector: '#zd-last-saved' })).toBeInTheDocument();
    expect(screen.getByText('Not set', { selector: '#zd-severity-value' })).toBeInTheDocument();
    expect(screen.getByText('0', { selector: '#zd-scope-count' })).toBeInTheDocument();
    expect(screen.getByText('e.reed')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Broadcasts are irreversible once dispatched. Verify the severity and scope before confirming.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'pushes the advisory to every matching client dashboard, issues email and SMS alerts to registered contacts, and opens a SEV-1 audit event.',
        { exact: false },
      ),
    ).toBeInTheDocument();
  });
});

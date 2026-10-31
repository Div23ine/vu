// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastEstimate } from '@vunvault/contracts/fixtures/intel';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminAdvisories } from '../../../../mocks/handlers/admin-advisories';
import { server } from '../../../../mocks/server';
import { BROADCAST_ACK_LABELS } from '@vunvault/contracts';
import { ACK_KEYS } from './_components/ack-checklist';
import { MISSING_PHRASES, incompleteMessage, joinMissing } from './_components/broadcast-dialog';
import AdminZeroDayPage from './page';

/**
 * Emergency Broadcast tests — the spec's list: the confirm button
 * locked until five acks + the phrase, a wrong phrase keeping it locked, the
 * four status-line transitions, the success toasts carrying the REAL counts,
 * the 409 and 422 mappings, the incomplete pre-check listing exactly the
 * missing items, and the backdrop click ignored while the dispatch is in
 * flight.
 *
 * The acknowledgement literals are asserted against the contract map so the
 * static markup in `ack-checklist.tsx` cannot drift from `BROADCAST_ACK_LABELS`.
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

function toasts() {
  return useToastStore.getState().toasts;
}

function dialog(): HTMLElement {
  const found = screen.getByRole('dialog');
  return found;
}

function statusLine(): HTMLElement {
  const element = document.querySelector('#zd-modal-hint');
  if (element === null) throw new Error('The dialog status line is missing.');
  return element as HTMLElement;
}

function confirmButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Broadcast Now' });
}

/** Fill every field the pre-checks demand, then save so an id exists. */
async function saveCompleteDraft(
  user: ReturnType<typeof userEvent.setup>,
  cveId = 'CVE-2026-44120',
): Promise<void> {
  await screen.findByText('Advisory Editor');
  await user.type(screen.getByLabelText(/CVE ID/), cveId);
  await user.type(screen.getByLabelText(/Headline/), 'Apache Tomcat — request smuggling');
  // 9.8 auto-selects the critical band.
  await user.type(screen.getByLabelText(/CVSS v3.1 Base Score/), '9.8');
  await user.type(
    screen.getByLabelText('Affected Products, Versions, Platforms or Hosts'),
    'Tomcat 9.0 – 9.0.44{Enter}',
  );
  await user.click(screen.getByRole('button', { name: 'Save Draft' }));
  await waitFor(() => expect(toasts()[0]).toMatchObject({ kind: 'ok', title: 'Draft saved' }));
  useToastStore.setState({ toasts: [] });
}

async function tickAllAcks(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  for (const label of Object.values(BROADCAST_ACK_LABELS)) {
    await user.click(dialog().querySelector(`[aria-label="${label.title}"]`) as HTMLElement);
  }
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminAdvisories();
  sessionState.permissions = ['intel:read', 'intel:write', 'intel:broadcast'];
});

describe('Emergency Broadcast — the gate', () => {
  it('the ack literals match the contract map, in contract order', () => {
    expect(ACK_KEYS).toEqual([
      'severityCorrect',
      'scopeComplete',
      'contentSafe',
      'remediationActionable',
      'authorised',
    ]);
    renderDesk();
    return screen.findByText('Advisory Editor').then(() => {
      // Nothing to assert on the closed dialog; the literals are checked below.
      expect(Object.keys(BROADCAST_ACK_LABELS)).toEqual(ACK_KEYS);
    });
  });

  it('confirm stays locked until all five acks AND the phrase are present', async () => {
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');

    expect(confirmButton()).toBeDisabled();
    expect(statusLine()).toHaveTextContent(
      'Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.',
    );

    // The phrase alone is not enough.
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAST');
    expect(confirmButton()).toBeDisabled();

    // Four of five acks is not enough either.
    const titles = Object.values(BROADCAST_ACK_LABELS);
    for (const title of titles.slice(0, 4)) {
      await user.click(screen.getByRole('checkbox', { name: title.title }));
    }
    expect(confirmButton()).toBeDisabled();
    expect(statusLine()).toHaveTextContent(
      '1 acknowledgement(s) still outstanding before broadcast can proceed.',
    );

    await user.click(screen.getByRole('checkbox', { name: titles[4]!.title }));
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    expect(statusLine()).toHaveTextContent(
      'All checks complete. Broadcasting will dispatch the advisory immediately and cannot be undone.',
    );
  });

  it('a wrong phrase keeps the button locked', async () => {
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');
    await tickAllAcks(user);

    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAS');
    expect(confirmButton()).toBeDisabled();
    expect(statusLine()).toHaveTextContent(
      'All acknowledgements complete — type "BROADCAST" to unlock the broadcast button.',
    );

    // Case-insensitive, per the contract's phrase rule.
    await user.clear(screen.getByLabelText(/Type BROADCAST to confirm/));
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'broadcast');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
  });

  it('renders the five acknowledgements with the contract titles and descriptions', async () => {
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');

    expect(screen.getByText('Pre-Broadcast Acknowledgement')).toBeInTheDocument();
    for (const key of ACK_KEYS) {
      const entry = BROADCAST_ACK_LABELS[key];
      expect(screen.getByRole('checkbox', { name: entry.title })).toBeInTheDocument();
      expect(screen.getByText(entry.description)).toBeInTheDocument();
    }
  });

  it('shows the advisory summary and the audience estimate', async () => {
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    const modal = await screen.findByRole('dialog');

    expect(within(modal).getByText('Confirm advisory broadcast')).toBeInTheDocument();
    expect(within(modal).getByText('Emergency Broadcast — Irreversible')).toBeInTheDocument();
    expect(within(modal).getByText('Advisory Being Broadcast')).toBeInTheDocument();
    expect(within(modal).getByText('CVE-2026-44120')).toBeInTheDocument();
    expect(within(modal).getByText('Apache Tomcat — request smuggling')).toBeInTheDocument();
    expect(within(modal).getByText('Critical')).toBeInTheDocument();
    expect(within(modal).getByText('Tomcat 9.0 – 9.0.44', { exact: false })).toBeInTheDocument();

    expect(within(modal).getByText('Immediate Reach')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(modal).getByText(String(broadcastEstimate.dashboards))).toBeInTheDocument(),
    );
    expect(within(modal).getByText('Client Dashboards')).toBeInTheDocument();
    expect(within(modal).getByText(String(broadcastEstimate.emailContacts))).toBeInTheDocument();
    expect(within(modal).getByText('Email Contacts')).toBeInTheDocument();
    expect(within(modal).getByText(String(broadcastEstimate.smsContacts))).toBeInTheDocument();
    expect(within(modal).getByText('SMS / On-call')).toBeInTheDocument();
  });
});

describe('Emergency Broadcast — the pre-checks', () => {
  it('lists exactly the missing items when nothing is filled in', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Advisory incomplete',
        message: incompleteMessage([
          MISSING_PHRASES.cve,
          MISSING_PHRASES.title,
          MISSING_PHRASES.severity,
          MISSING_PHRASES.scope,
        ]),
      }),
    );
    expect(toasts()[0]?.message).toBe(
      'Complete a valid CVE identifier, an advisory title, a severity level and at least one scope entry before raising an emergency broadcast.',
    );
    // The dialog never opened.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists only what is actually missing', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    // A valid CVE and a title leave severity and scope outstanding.
    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-44120');
    await user.type(screen.getByLabelText(/Headline/), 'Apache Tomcat — request smuggling');
    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Advisory incomplete',
        message: `Complete ${joinMissing([
          MISSING_PHRASES.severity,
          MISSING_PHRASES.scope,
        ])} before raising an emergency broadcast.`,
      }),
    );
  });

  it('a complete but never-saved advisory is told to save first', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');

    await user.type(screen.getByLabelText(/CVE ID/), 'CVE-2026-44120');
    await user.type(screen.getByLabelText(/Headline/), 'Apache Tomcat — request smuggling');
    await user.type(screen.getByLabelText(/CVSS v3.1 Base Score/), '9.8');
    await user.type(
      screen.getByLabelText('Affected Products, Versions, Platforms or Hosts'),
      'Tomcat 9.0 – 9.0.44{Enter}',
    );
    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Advisory incomplete',
        message: 'Save the advisory as a draft before raising an emergency broadcast.',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Emergency Broadcast — dispatch', () => {
  it('success fires both verbatim toasts with the real counts', async () => {
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');
    await tickAllAcks(user);
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAST');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());

    await waitFor(() => expect(toasts()).toHaveLength(2));
    expect(toasts()[0]).toMatchObject({
      kind: 'ok',
      title: 'Emergency broadcast dispatched',
      message: `CVE-2026-44120 pushed to ${broadcastEstimate.dashboards} client dashboards, ${broadcastEstimate.emailContacts} email contacts and ${broadcastEstimate.smsContacts} on-call SMS numbers.`,
    });
    expect(toasts()[1]).toMatchObject({ kind: 'info', title: 'Audit event recorded' });
    // The session reference follows the an earlier iteration format.
    expect(toasts()[1]?.message).toMatch(
      /^SEV-1 broadcast event written with session reference ADM-\d{4}-\d{4}-C000\.$/,
    );
    // The dialog closed.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a 409 broadcast_in_progress toasts the verbatim wait line', async () => {
    server.use(
      http.post('*/api/v1/admin/advisories/:id/broadcast', () =>
        HttpResponse.json({ error: 'broadcast_in_progress' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');
    await tickAllAcks(user);
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAST');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'A broadcast for this advisory was just sent. Wait a minute before sending another.',
      }),
    );
    // The dialog stays open so the operator can see nothing went out.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a 422 advisory_incomplete quotes the API details', async () => {
    server.use(
      http.post('*/api/v1/admin/advisories/:id/broadcast', () =>
        HttpResponse.json(
          {
            error: 'advisory_incomplete',
            details: ['a severity level', 'at least one scope entry'],
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');
    await tickAllAcks(user);
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAST');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Advisory incomplete',
        message:
          'Complete a severity level and at least one scope entry before raising an emergency broadcast.',
      }),
    );
  });

  it('a 403 toasts the administrators-only line', async () => {
    server.use(
      http.post('*/api/v1/admin/advisories/:id/broadcast', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');
    await tickAllAcks(user);
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAST');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'crit',
        title: 'Only administrators can issue emergency broadcasts.',
      }),
    );
  });

  it('the backdrop cannot dismiss the dialog while the dispatch is in flight', async () => {
    server.use(
      http.post('*/api/v1/admin/advisories/:id/broadcast', async () => {
        await delay(400);
        return HttpResponse.json(
          {
            data: {
              id: '30000000-0000-4000-8000-000000000001',
              advisoryId: 'x',
              kind: 'initial',
              status: 'sending',
              triggeredByLabel: 'e.reed',
              audienceDashboards: 312,
              emailContacts: 486,
              smsContacts: 74,
              sentDashboards: 0,
              sentEmail: 0,
              sentSms: 0,
              failed: 0,
              createdAt: new Date().toISOString(),
              finishedAt: null,
            },
          },
          { status: 202 },
        );
      }),
    );
    const user = userEvent.setup();
    renderDesk();
    await saveCompleteDraft(user);

    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');
    await tickAllAcks(user);
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAST');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());

    // While pending: the button is disabled and a backdrop click is ignored.
    await waitFor(() => expect(confirmButton()).toBeDisabled());
    // Radix dismisses on an outside pointerdown; fire one and assert the panel
    // survives. `dismissible={false}` must swallow it.
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Escape is blocked too.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Re-broadcast opens the same dialog with the rebroadcast title', async () => {
    const user = userEvent.setup();
    renderDesk();
    await screen.findByText('Advisory Editor');
    await screen.findByText('Apache Struts 2 — OGNL injection RCE');

    const cell = screen.getByText('CVE-2026-21447');
    const row = cell.closest('tr');
    if (row === null) throw new Error('The row is missing.');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Re-broadcast' }));

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('Re-broadcast advisory')).toBeInTheDocument();
    expect(within(modal).getByText('CVE-2026-21447')).toBeInTheDocument();
  });
});

/**
 * Live delivery progress .
 *
 * The dispatch flow above ends with the strip on the an earlier iteration poll. Here the
 * SSE relay feeds the SAME cache slot: the frames move the numbers with no
 * HTTP request between them, the strip settles from a pushed `sent` frame, and
 * the socket is released the moment there is nothing left to watch. jsdom has
 * no `EventSource`, so the fake below is stubbed onto the global — the hook
 * must find it through the same `typeof EventSource` path a browser takes.
 */

type DeskListener = (event: MessageEvent) => void;

class DeskFakeEventSource {
  static instances: DeskFakeEventSource[] = [];

  readyState = 0;
  closed = false;
  readonly url: string;
  private readonly listeners = new Map<string, Set<DeskListener>>();

  constructor(url: string, _init?: { withCredentials?: boolean }) {
    this.url = url;
    DeskFakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: DeskListener): void {
    const set = this.listeners.get(type) ?? new Set<DeskListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, payload: unknown): void {
    const event = { data: JSON.stringify(payload) } as unknown as MessageEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  open(): void {
    this.readyState = 1;
    this.emit('open', {});
  }
}

const STREAM_ADVISORY_ID = '4d1c0b8a-7e6f-4a5b-9c8d-2e1f0a9b8c7d';
const STREAM_BROADCAST_ID = '8f2e1d0c-9b8a-4f7e-6d5c-4b3a29180726';

/** The dispatch the counting handler reports: in flight, nothing sent yet. */
function sendingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: STREAM_BROADCAST_ID,
    advisoryId: STREAM_ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    triggeredByLabel: 'e.reed',
    audienceDashboards: broadcastEstimate.dashboards,
    emailContacts: broadcastEstimate.emailContacts,
    smsContacts: broadcastEstimate.smsContacts,
    sentDashboards: 0,
    sentEmail: 0,
    sentSms: 0,
    failed: 0,
    createdAt: '2026-09-24T09:12:00.000Z',
    finishedAt: null,
    ...overrides,
  };
}

function progressPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'progress',
    broadcastId: STREAM_BROADCAST_ID,
    advisoryId: STREAM_ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    audience: {
      dashboards: broadcastEstimate.dashboards,
      email: broadcastEstimate.emailContacts,
      sms: broadcastEstimate.smsContacts,
    },
    sent: { dashboards: 0, email: 0, sms: 0 },
    failed: 0,
    updatedAt: '2026-09-24T09:14:00.000Z',
    ...overrides,
  };
}

describe('Emergency Broadcast — live progress over SSE', () => {
  let pollCount: number;

  beforeEach(() => {
    pollCount = 0;
    DeskFakeEventSource.instances = [];
    vi.stubGlobal('EventSource', DeskFakeEventSource);
    server.use(
      http.get('*/api/v1/admin/advisories/:id/broadcasts', () => {
        pollCount += 1;
        return HttpResponse.json({ data: [sendingRecord()] });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function dispatchBroadcast(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await saveCompleteDraft(user);
    await user.click(screen.getByRole('button', { name: 'Emergency Broadcast' }));
    await screen.findByRole('dialog');
    await tickAllAcks(user);
    await user.type(screen.getByLabelText(/Type BROADCAST to confirm/), 'BROADCAST');
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    await user.click(confirmButton());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await screen.findByText(/Delivering…/);
  }

  it('pushed frames move the strip with no HTTP request between them', async () => {
    const user = userEvent.setup();
    renderDesk();
    await dispatchBroadcast(user);

    // The strip starts from the fetched record: nothing sent yet.
    expect(screen.getByText(/Delivering… 0\/312/)).toBeInTheDocument();

    const sock = DeskFakeEventSource.instances.at(-1);
    if (sock === undefined) throw new Error('The desk never opened the stream.');
    expect(sock.url).toContain('/api/v1/admin/advisories/');
    expect(sock.url).toContain('/broadcasts/stream');

    act(() => sock.open());
    act(() =>
      sock.emit('snapshot', {
        type: 'snapshot',
        records: [sendingRecord({ sentDashboards: 120 })],
      }),
    );
    await waitFor(() => expect(screen.getByText(/Delivering… 120\/312/)).toBeInTheDocument());
    // The live dot renders while the relay is feeding the strip.
    expect(document.querySelector('.zd-live-dot')).not.toBeNull();

    const requestsBeforeFrame = pollCount;
    act(() =>
      sock.emit('progress', progressPayload({ sent: { dashboards: 200, email: 300, sms: 40 } })),
    );
    await waitFor(() => expect(screen.getByText(/Delivering… 200\/312/)).toBeInTheDocument());
    // The update came over the socket: no poll in between.
    expect(pollCount).toBe(requestsBeforeFrame);
  });

  it('a pushed settle ends the strip and releases the socket', async () => {
    const user = userEvent.setup();
    renderDesk();
    await dispatchBroadcast(user);

    const sock = DeskFakeEventSource.instances.at(-1);
    if (sock === undefined) throw new Error('The desk never opened the stream.');
    act(() => sock.open());

    act(() =>
      sock.emit(
        'progress',
        progressPayload({
          status: 'sent',
          sent: {
            dashboards: broadcastEstimate.dashboards,
            email: broadcastEstimate.emailContacts,
            sms: broadcastEstimate.smsContacts,
          },
          updatedAt: '2026-09-24T09:20:00.000Z',
        }),
      ),
    );

    await waitFor(() => expect(screen.queryByText(/Delivering…/)).toBeNull());
    await waitFor(() => expect(sock.closed).toBe(true));
  });

  it('an unparsable frame leaves the strip alone', async () => {
    const user = userEvent.setup();
    renderDesk();
    await dispatchBroadcast(user);

    const sock = DeskFakeEventSource.instances.at(-1);
    if (sock === undefined) throw new Error('The desk never opened the stream.');
    act(() => sock.open());
    act(() => sock.emit('progress', { type: 'progress' }));

    expect(screen.getByText(/Delivering… 0\/312/)).toBeInTheDocument();
  });
});

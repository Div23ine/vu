// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContactMessageView } from '@vunvault/contracts';
import { CONTACT_CATEGORY_LABELS } from '@vunvault/contracts';
import { clientDirectory, contactMessages } from '@vunvault/contracts/fixtures/contact';
import { staffMembers } from '@vunvault/contracts/fixtures/users';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminContact } from '../../../../mocks/handlers/admin-contact';
import { server } from '../../../../mocks/server';
import AdminContactPage from './page';

/**
 * Contact Inbox tests — the spec's list: the inbox rows and filters,
 * the message dialog saving status and assignee, the verification banner and
 * its tab hand-off, and the badge grant/revoke permission gating and toasts.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const searchMock = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchMock.value,
}));

const sessionState = vi.hoisted(() => ({
  permissions: ['support:handle', 'users:read', 'users:manage'],
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

function renderInbox() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminContactPage />
    </QueryClientProvider>,
  );
}

function byEmail(email: string): ContactMessageView {
  const found = contactMessages.find((message) => message.email === email);
  if (found === undefined) throw new Error(`The contact fixture lost ${email}.`);
  return found;
}

/** The journalist/blogger request — the one that carries the verification banner. */
const VERIFICATION = contactMessages.find(
  (message) => message.category === 'journalist_blogger_profile_request',
) as ContactMessageView;
const PENTEST = byEmail('p.otieno@saccoone.co.ke');

function toasts() {
  return useToastStore.getState().toasts;
}

function inboxTable(): HTMLElement {
  const table = document.querySelector('#ct-panel-messages table');
  if (table === null) throw new Error('The inbox table is missing.');
  return table as HTMLElement;
}

/**
 * The DataTable renders a `<table>` while it is still showing skeleton rows, so
 * waiting on the element alone resolves too early. Wait for real subject cells.
 */
async function awaitInbox(): Promise<HTMLElement> {
  await waitFor(() => {
    expect(document.querySelectorAll('#ct-panel-messages .ct-subject').length).toBeGreaterThan(0);
  });
  return inboxTable();
}

function directoryTable(): HTMLElement {
  const table = document.querySelector('#ct-panel-clients table');
  if (table === null) throw new Error('The directory table is missing.');
  return table as HTMLElement;
}

/** The directory only renders a <table> once its query has landed. */
async function awaitDirectory(): Promise<HTMLElement> {
  await waitFor(() => {
    expect(document.querySelector('#ct-panel-clients table')).not.toBeNull();
  });
  return directoryTable();
}

function rowOf(table: HTMLElement, text: string): HTMLElement {
  const cell = within(table).getByText(text);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`The row for "${text}" is missing.`);
  return row as HTMLElement;
}

async function openClientsTab(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByText('Contact Inbox');
  await user.click(screen.getByRole('tab', { name: 'Clients & Badges' }));
  await awaitDirectory();
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminContact();
  routerMock.replace.mockReset();
  routerMock.replace.mockImplementation((url: string) => {
    searchMock.value = new URLSearchParams(url.split('?')[1] ?? '');
  });
  searchMock.value = new URLSearchParams();
  sessionState.permissions = ['support:handle', 'users:read', 'users:manage'];
});

describe('/admin/contact — chrome', () => {
  it('renders the authored copy and both tabs', async () => {
    renderInbox();
    await screen.findByRole('heading', { level: 1, name: 'Contact Inbox' });

    expect(screen.getByText('Support & Verification')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Public contact requests, vulnerability reports and Verified Blogger verification requests.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Messages' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Clients & Badges' })).toBeInTheDocument();
  });

  it('the summary chips count the whole queue, not the filtered page', async () => {
    renderInbox();
    await screen.findByText('Contact Inbox');

    const chips = screen.getByRole('status', { name: 'Contact queue summary' });
    const count = (status: string): number =>
      contactMessages.filter((message) => message.status === status).length;
    await waitFor(() => expect(within(chips).getByText(String(count('new')))).toBeInTheDocument());
    expect(within(chips).getByText('New')).toBeInTheDocument();
    expect(within(chips).getByText('Triaged')).toBeInTheDocument();
    expect(within(chips).getByText('Closed')).toBeInTheDocument();
    expect(within(chips).getByText(String(count('triaged')))).toBeInTheDocument();
    expect(within(chips).getByText(String(count('closed')))).toBeInTheDocument();
  });
});

describe('/admin/contact — inbox rows', () => {
  it('renders every fixture message with sender, category and status', async () => {
    renderInbox();
    await awaitInbox();

    for (const message of contactMessages) {
      expect(within(inboxTable()).getByText(message.subject)).toBeInTheDocument();
    }
    const row = rowOf(inboxTable(), PENTEST.subject);
    expect(within(row).getByText(PENTEST.name)).toBeInTheDocument();
    expect(within(row).getByText(PENTEST.email)).toBeInTheDocument();
    expect(within(row).getByText(PENTEST.organization as string)).toBeInTheDocument();
    // The category cell uses the API-minted label.
    expect(within(row).getByText(PENTEST.categoryLabel)).toBeInTheDocument();
    expect(within(row).getByText('Triaged')).toBeInTheDocument();
    expect(within(row).getByText(PENTEST.assignedTo?.label as string)).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: `Open message from ${PENTEST.name}` }),
    ).toBeInTheDocument();
  });

  it('the row never leaks the message body', async () => {
    renderInbox();
    await awaitInbox();

    // The body only ever renders inside the dialog.
    expect(within(inboxTable()).queryByText(PENTEST.message)).toBeNull();
  });

  it('the category filter offers the contract labels', async () => {
    renderInbox();
    await awaitInbox();

    for (const label of Object.values(CONTACT_CATEGORY_LABELS)) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
  });
});

describe('/admin/contact — filters', () => {
  it('each control writes its query parameter', async () => {
    renderInbox();
    await awaitInbox();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'new' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/contact?status=new');

    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'vulnerability_report' },
    });
    expect(routerMock.replace).toHaveBeenLastCalledWith(
      '/admin/contact?category=vulnerability_report',
    );

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'saccoone' } });
    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/contact?q=saccoone');
  });

  it('?q= narrows the queue to the matching sender', async () => {
    searchMock.value = new URLSearchParams('q=saccoone');
    renderInbox();
    await awaitInbox();

    expect(within(inboxTable()).getByText(PENTEST.subject)).toBeInTheDocument();
    expect(within(inboxTable()).queryByText(VERIFICATION.subject)).toBeNull();
  });

  it('?status= narrows to that status', async () => {
    searchMock.value = new URLSearchParams('status=new');
    renderInbox();
    await awaitInbox();

    for (const message of contactMessages) {
      const present = within(inboxTable()).queryByText(message.subject) !== null;
      expect(present).toBe(message.status === 'new');
    }
  });

  it('Reset clears the URL and toasts', async () => {
    const user = userEvent.setup();
    searchMock.value = new URLSearchParams('status=closed');
    renderInbox();
    await awaitInbox();

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(routerMock.replace).toHaveBeenLastCalledWith('/admin/contact');
    expect(toasts()[0]).toMatchObject({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full contact queue.',
    });
  });

  it('an empty result offers a reset', async () => {
    searchMock.value = new URLSearchParams('q=zzz-no-such-sender');
    renderInbox();

    expect(await screen.findByText('No messages match the current filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
  });
});

describe('/admin/contact — message dialog', () => {
  it('shows the full body and saves status and assignee', async () => {
    const user = userEvent.setup();
    const patches: { id: string; body: unknown }[] = [];
    server.use(
      http.patch('*/api/v1/admin/contact/:id', async ({ params, request }) => {
        patches.push({ id: String(params.id), body: await request.json() });
        return HttpResponse.json({ data: { ...PENTEST, status: 'closed' } });
      }),
    );
    renderInbox();
    await awaitInbox();

    await user.click(
      within(rowOf(inboxTable(), PENTEST.subject)).getByRole('button', {
        name: `Open message from ${PENTEST.name}`,
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(PENTEST.subject)).toBeInTheDocument();
    expect(within(dialog).getByText(PENTEST.message)).toBeInTheDocument();
    expect(within(dialog).getByText(PENTEST.categoryLabel)).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('Status'), 'closed');
    const assignee = staffMembers.find(
      (member) => member.accountStatus === 'active' && member.id !== PENTEST.assignedTo?.id,
    )!;
    await user.selectOptions(within(dialog).getByLabelText('Assigned to'), assignee.id);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]?.id).toBe(PENTEST.id);
    expect(patches[0]?.body).toMatchObject({ status: 'closed', assignedTo: assignee.id });
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Message updated',
        message: 'The request was saved.',
      }),
    );
  });

  it('the assignee select lists active staff and an Unassigned option', async () => {
    const user = userEvent.setup();
    renderInbox();
    await awaitInbox();

    await user.click(
      within(rowOf(inboxTable(), PENTEST.subject)).getByRole('button', {
        name: `Open message from ${PENTEST.name}`,
      }),
    );
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('option', { name: 'Unassigned' })).toBeInTheDocument();
    const active = staffMembers.filter((member) => member.accountStatus === 'active');
    expect(active.length).toBeGreaterThan(0);
    for (const member of active) {
      expect(within(dialog).getByRole('option', { name: member.fullName })).toBeInTheDocument();
    }
  });

  it('a verification request shows the banner and hands off to the directory', async () => {
    const user = userEvent.setup();
    renderInbox();
    await awaitInbox();

    await user.click(
      within(rowOf(inboxTable(), VERIFICATION.subject)).getByRole('button', {
        name: `Open message from ${VERIFICATION.name}`,
      }),
    );
    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByText(/^Verification request — grant the Verified Blogger badge/),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Find client' }));

    // The dialog closed, the tab switched, and the search is pre-filled with the
    // sender's email.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('tab', { name: 'Clients & Badges' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Search clients')).toHaveValue(VERIFICATION.email);

    // The hand-off banner names the email it filtered on. The applicant is not
    // yet a client, so the directory correctly answers with its empty state —
    // which is the whole point of the banner: verify first, then grant.
    const handoff = await screen.findByText(/Filtered to/);
    expect(handoff).toHaveTextContent(
      `Filtered to ${VERIFICATION.email} from the verification request.`,
    );
    expect(
      screen.getByText(VERIFICATION.email, { selector: '.ct-handoff strong' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('No clients match this search')).toBeInTheDocument();

    // Clearing the search brings the directory back.
    await user.clear(screen.getByLabelText('Search clients'));
    await awaitDirectory();
    expect(within(directoryTable()).getByText(clientDirectory[0]!.fullName)).toBeInTheDocument();
  });

  it('a non-verification message shows no banner', async () => {
    const user = userEvent.setup();
    renderInbox();
    await awaitInbox();

    await user.click(
      within(rowOf(inboxTable(), PENTEST.subject)).getByRole('button', {
        name: `Open message from ${PENTEST.name}`,
      }),
    );
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByText(/^Verification request/)).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Find client' })).toBeNull();
  });
});

describe('/admin/contact — clients and badges', () => {
  it('renders the directory with client codes and badge state', async () => {
    const user = userEvent.setup();
    renderInbox();
    await openClientsTab(user);

    for (const client of clientDirectory) {
      expect(within(directoryTable()).getByText(client.fullName)).toBeInTheDocument();
      expect(within(directoryTable()).getByText(client.email)).toBeInTheDocument();
    }
    const jane = clientDirectory.find((client) => !client.verifiedBlogger)!;
    const verified = clientDirectory.find((client) => client.verifiedBlogger)!;
    const janeRow = rowOf(directoryTable(), jane.fullName);
    expect(within(janeRow).getByText(jane.clientCode as string)).toBeInTheDocument();
    expect(within(janeRow).getByText('Not verified')).toBeInTheDocument();
    expect(
      within(rowOf(directoryTable(), verified.fullName)).getByText('Verified'),
    ).toBeInTheDocument();
  });

  it('Grant badge confirms, posts and toasts', async () => {
    const user = userEvent.setup();
    const posts: string[] = [];
    server.use(
      http.post('*/api/v1/admin/users/:id/blogger-badge', ({ params }) => {
        posts.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderInbox();
    await openClientsTab(user);

    const target = clientDirectory.find((client) => !client.verifiedBlogger)!;
    await user.click(
      within(rowOf(directoryTable(), target.fullName)).getByRole('button', {
        name: 'Grant badge',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Grant Verified Blogger badge')).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(target.fullName))).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Grant badge' }));

    await waitFor(() => expect(posts).toEqual([target.id]));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Badge granted',
        message: `${target.email} can now use the Content Studio.`,
      }),
    );
  });

  it('Revoke badge confirms, deletes and toasts', async () => {
    const user = userEvent.setup();
    const deletes: string[] = [];
    server.use(
      http.delete('*/api/v1/admin/users/:id/blogger-badge', ({ params }) => {
        deletes.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderInbox();
    await openClientsTab(user);

    const target = clientDirectory.find((client) => client.verifiedBlogger)!;
    await user.click(
      within(rowOf(directoryTable(), target.fullName)).getByRole('button', {
        name: 'Revoke badge',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Revoke Verified Blogger badge')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Revoke badge' }));

    await waitFor(() => expect(deletes).toEqual([target.id]));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Badge revoked',
        message: `${target.email} can no longer submit articles.`,
      }),
    );
  });

  it('without users:manage the action column offers nothing', async () => {
    sessionState.permissions = ['support:handle', 'users:read'];
    const user = userEvent.setup();
    renderInbox();
    await openClientsTab(user);

    expect(within(directoryTable()).queryByRole('button', { name: 'Grant badge' })).toBeNull();
    expect(within(directoryTable()).queryByRole('button', { name: 'Revoke badge' })).toBeNull();
    expect(within(directoryTable()).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('without users:read the whole tab is hidden', async () => {
    sessionState.permissions = ['support:handle'];
    renderInbox();
    await awaitInbox();

    expect(screen.queryByRole('tab', { name: 'Clients & Badges' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Messages' })).toBeInTheDocument();
  });

  it('the directory search filters by email', async () => {
    const user = userEvent.setup();
    renderInbox();
    await openClientsTab(user);

    const target = clientDirectory[0]!;
    await user.type(screen.getByLabelText('Search clients'), target.email);

    await waitFor(() => {
      const names = within(directoryTable())
        .getAllByRole('row')
        .map((row) => row.textContent ?? '');
      expect(names.some((text) => text.includes(target.fullName))).toBe(true);
      const other = clientDirectory.find((client) => client.email !== target.email)!;
      expect(names.some((text) => text.includes(other.email))).toBe(false);
    });
  });
});

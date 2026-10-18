// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHANNEL_TOGGLES, NOTIFICATION_EVENT_META } from '@vunvault/contracts';
import {
  mfaStatus,
  notificationPrefs,
  securityPosture,
  sessions as sessionFixture,
} from '@vunvault/contracts/fixtures/account';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminProfile } from '../../../../mocks/handlers/admin-profile';
import { server } from '../../../../mocks/server';
import AdminProfilePage from './page';

/**
 * Security & Credentials + Notification Preferences tests — the
 * spec's list: the posture card rendering the API values, the password card
 * being the IMPORTED portal component (asserted by test id, which is the only
 * honest way to prove reuse rather than a copy), the sessions list with revoke
 * and revoke-others, the deactivation request and its 409, and the notification
 * matrix with its reset-and-save behaviour.
 */

const sessionState = vi.hoisted(() => ({
  permissions: ['dashboard:read', 'profile:read', 'profile:write'],
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

function renderProfile() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminProfilePage />
    </QueryClientProvider>,
  );
}

function toasts() {
  return useToastStore.getState().toasts;
}

async function openTab(user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> {
  await screen.findByText('Evelyn Reed');
  await user.click(screen.getByRole('tab', { name: label }));
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminProfile();
  window.location.hash = '';
  sessionState.permissions = ['dashboard:read', 'profile:read', 'profile:write'];
});

describe('/admin/profile#security — posture card', () => {
  it('renders the score, label and every checklist item from the API', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Password & 2FA');

    expect(await screen.findByText(securityPosture.label)).toBeInTheDocument();
    expect(screen.getByText(String(securityPosture.score))).toBeInTheDocument();
    expect(
      screen.getByText(
        `${securityPosture.completed} of ${securityPosture.total} controls in place`,
      ),
    ).toBeInTheDocument();

    const meter = screen.getByRole('progressbar', { name: 'Security posture score' });
    expect(meter).toHaveAttribute('aria-valuenow', String(securityPosture.score));

    for (const item of securityPosture.items) {
      const row = screen.getByText(item.label).closest('li');
      expect(row).not.toBeNull();
      expect(row).toHaveClass(item.done ? 'is-done' : 'is-todo');
      expect(
        within(row as HTMLElement).getByText(item.done ? 'Complete' : 'Outstanding'),
      ).toBeInTheDocument();
    }
  });

  it('the password card is the imported portal component, not a copy', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Password & 2FA');

    const wrapper = await screen.findByTestId('ps-imported-change-password');
    // The imported card's own heading and staff-minimum helper prove it is the
    // portal component rendering, not a local re-implementation.
    expect(within(wrapper).getByText('Change Password')).toBeInTheDocument();
    expect(
      within(wrapper).getByText('Staff accounts require at least 14 characters.'),
    ).toBeInTheDocument();
  });

  it('the imported MFA surfaces render their fixture data', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Password & 2FA');

    const keyName = mfaStatus.webauthn.keys[0]?.deviceName ?? '';
    expect(keyName).not.toBe('');
    expect(await screen.findByText(keyName)).toBeInTheDocument();
    // Require 2FA is enforced for staff: checked and inert.
    const require2fa = screen.getByRole('switch', { name: 'Require 2FA at every sign-in' });
    expect(require2fa).toBeDisabled();
    expect(require2fa).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Required for all staff accounts.')).toBeInTheDocument();
  });
});

describe('/admin/profile#security — active sessions', () => {
  it('lists every fixture session with a This device chip on the current one', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Password & 2FA');

    expect(await screen.findByText('Active Sessions')).toBeInTheDocument();
    for (const session of sessionFixture) {
      expect(screen.getByText(session.deviceLabel)).toBeInTheDocument();
      // Each IP is unique; two sessions share a rendered location, so that one
      // is counted rather than matched singly.
      expect(screen.getByText(new RegExp(session.ip as string))).toBeInTheDocument();
    }
    const nairobi = sessionFixture.filter((session) => session.location === 'Nairobi, KE').length;
    expect(nairobi).toBeGreaterThan(1);
    expect(screen.getAllByText(/Nairobi, KE/)).toHaveLength(nairobi);
    const current = sessionFixture.find((session) => session.current);
    expect(screen.getAllByText('This device')).toHaveLength(1);
    // The session in use cannot revoke itself.
    const currentRow = screen.getByText(current!.deviceLabel).closest('li');
    expect(
      within(currentRow as HTMLElement).getByRole('button', { name: 'Revoke' }),
    ).toBeDisabled();
  });

  it('Revoke deletes that session', async () => {
    const user = userEvent.setup();
    const deletes: string[] = [];
    server.use(
      http.delete('*/api/v1/account/sessions/:id', ({ params }) => {
        deletes.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderProfile();
    await openTab(user, 'Password & 2FA');
    await screen.findByText('Active Sessions');

    const target = sessionFixture.find((session) => !session.current)!;
    const row = screen.getByText(target.deviceLabel).closest('li');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(deletes).toEqual([target.id]));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Session revoked',
        message: `${target.deviceLabel} was signed out.`,
      }),
    );
  });

  it('Sign out all other sessions reports the count the API revoked', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Password & 2FA');
    await screen.findByText('Active Sessions');

    const others = sessionFixture.filter((session) => !session.current).length;
    await user.click(screen.getByRole('button', { name: 'Sign out all other sessions' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Sessions revoked',
        message: `${others} other session(s) were signed out.`,
      }),
    );
    // Only the current session survives.
    await waitFor(() => expect(screen.getAllByText('This device')).toHaveLength(1));
    for (const session of sessionFixture.filter((candidate) => !candidate.current)) {
      expect(screen.queryByText(session.deviceLabel)).toBeNull();
    }
  });
});

describe('/admin/profile#security — deactivation', () => {
  it('a short reason is refused before any request', async () => {
    const user = userEvent.setup();
    const posts: string[] = [];
    server.use(
      http.post('*/api/v1/account/deactivation-request', async ({ request }) => {
        posts.push(JSON.stringify(await request.json()));
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderProfile();
    await openTab(user, 'Password & 2FA');

    await user.click(screen.getByRole('button', { name: 'Request Account Deactivation' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await user.type(within(dialog).getByLabelText(/Reason/), 'too short');
    await user.click(within(dialog).getByRole('button', { name: 'Send request' }));

    expect(
      await within(dialog).findByText('Add a reason of at least 10 characters.'),
    ).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('a valid reason posts and toasts', async () => {
    const user = userEvent.setup();
    const bodies: { reason: string }[] = [];
    server.use(
      http.post('*/api/v1/account/deactivation-request', async ({ request }) => {
        bodies.push((await request.json()) as { reason: string });
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderProfile();
    await openTab(user, 'Password & 2FA');

    await user.click(screen.getByRole('button', { name: 'Request Account Deactivation' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText(/Reason/),
      'Moving to a role with no platform access.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ reason: 'Moving to a role with no platform access.' });
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Request sent',
        message: 'A super administrator will review your deactivation request.',
      }),
    );
  });

  it('a 409 already_requested toasts the verbatim line', async () => {
    server.use(
      http.post('*/api/v1/account/deactivation-request', () =>
        HttpResponse.json({ error: 'already_requested' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Password & 2FA');

    await user.click(screen.getByRole('button', { name: 'Request Account Deactivation' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText(/Reason/),
      'Leaving the organisation next month.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send request' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'You already have a pending request.',
      }),
    );
  });
});

describe('/admin/profile#notifications', () => {
  it('renders every contract event with the mandated accessible names', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Notifications');

    // The string appears twice by design: the panel label and the table's
    // sr-only caption.
    expect(
      await screen.findAllByText('Notification channel preferences per event category'),
    ).toHaveLength(2);
    expect(screen.getByText('Critical security alerts are always delivered.')).toBeInTheDocument();

    for (const meta of Object.values(NOTIFICATION_EVENT_META)) {
      expect(screen.getByText(meta.title)).toBeInTheDocument();
      expect(screen.getByText(meta.description)).toBeInTheDocument();
      for (const channel of ['In-App', 'Email', 'SMS', 'Push']) {
        expect(
          screen.getByRole('checkbox', { name: `${meta.title} — ${channel}` }),
        ).toBeInTheDocument();
      }
    }
    // The four groups are rendered as section rows.
    for (const group of [
      'Security & Access',
      'Scan Operations',
      'Threat Intelligence',
      'Administrative',
    ]) {
      expect(screen.getByRole('columnheader', { name: group })).toBeInTheDocument();
    }
  });

  it('the matrix reflects the fixture toggles', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openTab(user, 'Notifications');
    await screen.findByText('Critical security alerts are always delivered.');

    const first = Object.values(NOTIFICATION_EVENT_META)[0]!;
    expect(screen.getByRole('checkbox', { name: `${first.title} — In-App` })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: `${first.title} — SMS` })).not.toBeChecked();
  });

  it('Reset to Defaults changes the form only, then Save sends it', async () => {
    const user = userEvent.setup();
    const puts: unknown[] = [];
    server.use(
      http.put('*/api/v1/account/notifications', async ({ request }) => {
        puts.push(await request.json());
        return HttpResponse.json({ data: notificationPrefs });
      }),
    );
    renderProfile();
    await openTab(user, 'Notifications');
    await screen.findByText('Critical security alerts are always delivered.');

    // Turn on a channel the defaults keep off.
    const first = Object.values(NOTIFICATION_EVENT_META)[0]!;
    const push = screen.getByRole('checkbox', { name: `${first.title} — Push` });
    await user.click(push);
    expect(push).toBeChecked();
    expect(puts).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
    expect(toasts()[0]).toMatchObject({
      kind: 'info',
      title: 'Notifications reset',
      message: 'Restored to VUNVAULT defaults.',
    });
    // The reset restores the contract's DEFAULT_CHANNEL_TOGGLES — push is off by
    // default, so the box we just ticked is unticked — and nothing was sent.
    expect(DEFAULT_CHANNEL_TOGGLES.push).toBe(false);
    expect(push).not.toBeChecked();
    expect(puts).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    await waitFor(() =>
      expect(toasts().some((entry) => entry.title === 'Notification preferences saved')).toBe(true),
    );
    const saved = toasts().find((entry) => entry.title === 'Notification preferences saved');
    expect(saved?.message).toMatch(/^Channel matrix updated at \d{2}:\d{2}:\d{2} UTC\.$/);
  });

  it('quiet hours can be enabled and saved with the contract time format', async () => {
    const user = userEvent.setup();
    const puts: { quietHours?: { enabled: boolean; from: string | null; to: string | null } }[] =
      [];
    server.use(
      http.put('*/api/v1/account/notifications', async ({ request }) => {
        puts.push((await request.json()) as (typeof puts)[number]);
        return HttpResponse.json({ data: notificationPrefs });
      }),
    );
    renderProfile();
    await openTab(user, 'Notifications');
    await screen.findByText('Critical security alerts are always delivered.');

    const toggle = screen.getByRole('switch', { name: 'Quiet hours' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();

    await user.type(screen.getByLabelText('From'), '22:00');
    await user.type(screen.getByLabelText('To'), '06:30');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]?.quietHours).toEqual({ enabled: true, from: '22:00', to: '06:30' });
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_LABELS } from '@vunvault/contracts';
import { profileSettings } from '@vunvault/contracts/fixtures/account';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetAdminProfile } from '../../../../mocks/handlers/admin-profile';
import { server } from '../../../../mocks/server';
import AdminProfilePage from './page';

/**
 * Profile Settings tests — the spec's list: the header values from
 * MSW, the hash-driven tabs, the Save payload, the avatar type and size
 * rejections and the three-request upload order, avatar removal, and the
 * read-only Work Email.
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

/** Every request URL, in order — the avatar chain's order is the assertion. */
let requestLog: string[] = [];

function png(name = 'avatar.png', bytes = 2048): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetAdminProfile();
  requestLog = [];
  window.location.hash = '';
  sessionState.permissions = ['dashboard:read', 'profile:read', 'profile:write'];
  server.events.on('request:start', ({ request }) => {
    requestLog.push(`${request.method} ${new URL(request.url).pathname}`);
  });
});

afterEach(() => {
  server.events.removeAllListeners();
  window.location.hash = '';
});

describe('/admin/profile — identity header', () => {
  it('renders every value from the settings fixture', async () => {
    renderProfile();
    await screen.findByText(`${profileSettings.firstName} ${profileSettings.lastName}`);

    expect(screen.getByText('Verified Administrator')).toBeInTheDocument();
    expect(screen.getByText(ROLE_LABELS[profileSettings.role])).toBeInTheDocument();
    expect(screen.getByText(/Member since Mar 2024/)).toBeInTheDocument();
    expect(screen.getByText(`@${profileSettings.username}`)).toBeInTheDocument();
    expect(screen.getByText(profileSettings.email)).toBeInTheDocument();
    expect(screen.getByText(profileSettings.bio as string)).toBeInTheDocument();

    expect(screen.getByText('MFA:')).toBeInTheDocument();
    expect(screen.getByText(profileSettings.mfaSummary)).toBeInTheDocument();
    expect(screen.getByText('Last sign-in:')).toBeInTheDocument();
    expect(screen.getByText(`Sessions:`)).toBeInTheDocument();
    expect(screen.getByText(`${profileSettings.activeSessions} active`)).toBeInTheDocument();

    // No incident-commander label: the API supplies no such flag.
    expect(screen.queryByText(/Incident Commander/)).toBeNull();
  });

  it('falls back to the initials disc when there is no avatar', async () => {
    renderProfile();
    await screen.findByText('Evelyn Reed');

    const avatar = document.querySelector('#ps-identity-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveTextContent('ER');
    expect(avatar?.querySelector('img')).toBeNull();
  });
});

describe('/admin/profile — tabs', () => {
  it('renders the four tabs with Personal Details selected by default', async () => {
    renderProfile();
    await screen.findByText('Evelyn Reed');

    const tablist = screen.getByRole('tablist', { name: 'Profile settings sections' });
    expect(within(tablist).getByRole('tab', { name: 'Personal Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    for (const label of ['Profile Picture', 'Password & 2FA', 'Notifications']) {
      expect(within(tablist).getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'false',
      );
    }
    // Only the active panel is visible.
    expect(document.querySelector('#ps-panel-personal')).toBeVisible();
    expect(document.querySelector('#ps-panel-picture')).not.toBeVisible();
  });

  it('a deep link lands on the hashed tab', async () => {
    window.location.hash = '#security';
    renderProfile();
    await screen.findByText('Evelyn Reed');

    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByRole('tab', { name: 'Password & 2FA' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(document.querySelector('#ps-panel-security')).toBeVisible();
    expect(document.querySelector('#ps-panel-personal')).not.toBeVisible();
  });

  it('an unknown hash falls back to the first tab', async () => {
    window.location.hash = '#nonsense';
    renderProfile();
    await screen.findByText('Evelyn Reed');

    expect(screen.getByRole('tab', { name: 'Personal Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('clicking a tab moves the selection and the hash', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Evelyn Reed');

    await user.click(screen.getByRole('tab', { name: 'Profile Picture' }));

    expect(screen.getByRole('tab', { name: 'Profile Picture' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(document.querySelector('#ps-panel-picture')).toBeVisible();
    expect(window.location.hash).toBe('#picture');
  });

  it('arrow keys move between tabs', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Evelyn Reed');

    screen.getByRole('tab', { name: 'Personal Details' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Profile Picture' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Profile Picture' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Personal Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('/admin/profile — personal details', () => {
  it('pre-fills from the fixture and renders the contract options', async () => {
    renderProfile();
    await screen.findByText('Evelyn Reed');

    expect(screen.getByLabelText(/First Name/)).toHaveValue(profileSettings.firstName);
    expect(screen.getByLabelText(/Last Name/)).toHaveValue(profileSettings.lastName);
    expect(screen.getByLabelText(/Display Name/)).toHaveValue(profileSettings.displayName);
    expect(screen.getByLabelText('Time Zone')).toHaveValue(profileSettings.timezone);
    expect(screen.getByLabelText('Interface Language')).toHaveValue(profileSettings.language);
    expect(screen.getByLabelText('Short Biography')).toHaveValue(profileSettings.bio as string);

    // Options come from the contract records.
    expect(
      screen.getByRole('option', { name: 'Africa/Nairobi — EAT (UTC+3)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Asia/Dubai — GST (UTC+4)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Kiswahili' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument();

    expect(screen.getByText(`${(profileSettings.bio as string).length} / 400`)).toBeInTheDocument();
  });

  it('Work Email is read-only and never in the payload', async () => {
    const user = userEvent.setup();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.patch('*/api/v1/account/settings', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: profileSettings });
      }),
    );
    renderProfile();
    await screen.findByText('Evelyn Reed');

    const email = screen.getByLabelText(/Work Email/);
    expect(email).toHaveValue(profileSettings.email);
    expect(email).toHaveAttribute('readonly');
    // Typing into a read-only field changes nothing.
    await user.type(email, 'changed');
    expect(email).toHaveValue(profileSettings.email);

    await user.clear(screen.getByLabelText(/Direct Phone/));
    await user.type(screen.getByLabelText(/Direct Phone/), '+254 705 998 032');
    await user.click(screen.getByRole('button', { name: 'Save Personal Details' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('email');
    expect(bodies[0]).toMatchObject({
      firstName: profileSettings.firstName,
      lastName: profileSettings.lastName,
      phone: '+254 705 998 032',
      timezone: profileSettings.timezone,
      language: profileSettings.language,
    });
  });

  it('Save is disabled while pristine and toasts the verbatim pair after an edit', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Evelyn Reed');

    const save = screen.getByRole('button', { name: 'Save Personal Details' });
    expect(save).toBeDisabled();

    await user.clear(screen.getByLabelText('Job Title'));
    await user.type(screen.getByLabelText('Job Title'), 'Chief Security Officer');
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Personal details saved',
      }),
    );
    expect(toasts()[0]?.message).toMatch(
      /^Profile updated at \d{2}:\d{2}:\d{2} UTC and written to the audit log\.$/,
    );
  });

  it('Reset restores the last saved values and toasts', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Evelyn Reed');

    const first = screen.getByLabelText(/First Name/);
    await user.clear(first);
    await user.type(first, 'Changed');
    expect(first).toHaveValue('Changed');

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(first).toHaveValue(profileSettings.firstName);
    expect(toasts()[0]).toMatchObject({
      kind: 'info',
      title: 'Personal details reset',
      message: 'Restored to the last saved values.',
    });
  });

  it('an empty first name is refused before any request', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Evelyn Reed');

    await user.clear(screen.getByLabelText(/First Name/));
    await user.click(screen.getByRole('button', { name: 'Save Personal Details' }));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    // Only the initial GET is allowed — the invalid form must not PATCH.
    expect(requestLog.filter((entry) => entry === 'PATCH /api/v1/account/settings')).toHaveLength(
      0,
    );
  });
});

describe('/admin/profile — avatar', () => {
  async function openPictureTab(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await screen.findByText('Evelyn Reed');
    await user.click(screen.getByRole('tab', { name: 'Profile Picture' }));
    await screen.findByText('Drag & drop your image here');
  }

  it('renders the drop zone, the accepted formats and both actions', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openPictureTab(user);

    expect(screen.getByRole('heading', { name: 'Profile Picture' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Upload a square image at least 256×256 px. It appears in the header, audit log, contributor cards and client-facing dashboards where your name is shown.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('No upload')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Or click to browse. Accepted: PNG, JPG, WEBP, SVG — up to 4 MB. Square crops preferred.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Current Picture' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate From Initials' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Files are scanned for embedded malware, stripped of all EXIF metadata and stored encrypted on the VUNVAULT CDN/,
      ),
    ).toBeInTheDocument();
  });

  it('an oversized file is refused client-side, before any request', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openPictureTab(user);

    // One byte over the contract's AVATAR_MAX_BYTES.
    await user.upload(screen.getByLabelText('Profile picture file'), png('big.png', 4_194_305));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'File too large',
        message: 'Avatar uploads are limited to 4 MB.',
      }),
    );
    expect(requestLog.filter((entry) => entry.includes('/account/avatar'))).toHaveLength(0);
  });

  it('an unsupported type is refused client-side, before any request', async () => {
    renderProfile();
    const user = userEvent.setup();
    await openPictureTab(user);

    // A dropped file bypasses the input's `accept` filter entirely, which is
    // exactly why the component checks the type itself.
    const gif = new File([new Uint8Array(64)], 'avatar.gif', { type: 'image/gif' });
    fireEvent.drop(screen.getByRole('button', { name: 'Upload a profile picture' }), {
      dataTransfer: { files: [gif], types: ['Files'] },
    });

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Unsupported file type',
        message: 'Please upload a PNG, JPG, WEBP or SVG image.',
      }),
    );
    expect(requestLog.filter((entry) => entry.includes('/account/avatar'))).toHaveLength(0);
  });

  it('an oversized drop is refused too', async () => {
    renderProfile();
    const user = userEvent.setup();
    await openPictureTab(user);

    const huge = png('big.png', 4_194_305);
    fireEvent.drop(screen.getByRole('button', { name: 'Upload a profile picture' }), {
      dataTransfer: { files: [huge], types: ['Files'] },
    });

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'File too large',
        message: 'Avatar uploads are limited to 4 MB.',
      }),
    );
  });

  it('a valid upload runs mint → PUT → confirm, in that order', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openPictureTab(user);

    await user.upload(screen.getByLabelText('Profile picture file'), png());

    await waitFor(() => expect(toasts()[0]).toMatchObject({ kind: 'ok', title: 'Avatar updated' }));
    expect(toasts()[0]?.message).toMatch(
      /^Image accepted and queued for security scanning at \d{2}:\d{2}:\d{2} UTC\.$/,
    );

    const avatarPaths = requestLog.filter(
      (entry) => entry.includes('/account/avatar') || entry.includes('/avatars/'),
    );
    expect(avatarPaths).toEqual([
      'POST /api/v1/account/avatar/upload-url',
      expect.stringMatching(/^PUT \/avatars\/.+\.png$/),
      'POST /api/v1/account/avatar/confirm',
    ]);
  });

  it('Remove deletes the avatar and toasts the fallback line', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openPictureTab(user);

    await user.upload(screen.getByLabelText('Profile picture file'), png());
    await waitFor(() => expect(toasts()[0]?.title).toBe('Avatar updated'));

    const remove = screen.getByRole('button', { name: 'Remove Current Picture' });
    await waitFor(() => expect(remove).toBeEnabled());
    useToastStore.setState({ toasts: [] });
    await user.click(remove);

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'info',
        title: 'Avatar removed',
        message: 'Falling back to initials across the platform.',
      }),
    );
    expect(requestLog.filter((entry) => entry === 'DELETE /api/v1/account/avatar')).toHaveLength(1);
  });

  it('Generate From Initials makes no API call', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openPictureTab(user);

    const before = requestLog.length;
    await user.click(screen.getByRole('button', { name: 'Generate From Initials' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'info',
        title: 'Avatar generated',
        message: 'Initials image created for your account.',
      }),
    );
    expect(requestLog).toHaveLength(before);
  });
});

describe('/admin/profile — head actions', () => {
  it('Discard Changes reverts the form and toasts', async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByText('Evelyn Reed');

    const first = screen.getByLabelText(/First Name/);
    await user.clear(first);
    await user.type(first, 'Discarded');

    await user.click(screen.getByRole('button', { name: 'Discard Changes' }));

    expect(first).toHaveValue(profileSettings.firstName);
    expect(toasts()[0]).toMatchObject({
      kind: 'info',
      title: 'Changes discarded',
      message: 'All unsaved edits have been reverted to the last saved state.',
    });
  });

  it('Save All Changes drives the personal panel and toasts', async () => {
    const user = userEvent.setup();
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.patch('*/api/v1/account/settings', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: profileSettings });
      }),
    );
    renderProfile();
    await screen.findByText('Evelyn Reed');

    await user.clear(screen.getByLabelText('Job Title'));
    await user.type(screen.getByLabelText('Job Title'), 'Incident Response Lead');
    await user.click(screen.getByRole('button', { name: 'Save All Changes' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ jobTitle: 'Incident Response Lead' });
    await waitFor(() =>
      expect(toasts().some((entry) => entry.title === 'All changes saved')).toBe(true),
    );
  });
});

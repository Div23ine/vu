// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { clientProfile } from '@vunvault/contracts/fixtures/profile';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../../mocks/server';
import { ProfileForm } from './_components/profile-form';
import { ProfileHero } from './_components/profile-hero';

/**
 * Client profile tests (Task 68) — the spec's list: the header shows
 * `VV-CL-48210` and the MSW-served stats, the work email is read-only, the
 * PATCH body matches `UpdateProfileBody`, the success toast + `Last saved
 * just now` footer, the dirty guard disables Save, and a `400
 * validation_failed` maps its `details` paths onto fields.
 */

let queryClient: QueryClient;
let patchBodies: Array<Record<string, unknown>>;

function renderPage() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileHero />
      <ProfileForm />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  patchBodies = [];
});

describe('Profile — identity header', () => {
  it('shows the client code, plan chips and the API stats', async () => {
    renderPage();
    expect(await screen.findByText('Jane Wanjiru')).toBeInTheDocument();
    expect(screen.getByText('Acme Fintech Ltd · Head of Information Security')).toBeInTheDocument();
    expect(screen.getByText('CLIENT ID VV-CL-48210')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Client')).toBeInTheDocument();
    expect(screen.getByText('Subscription Active')).toBeInTheDocument();

    const stats = screen.getByLabelText('Account summary');
    expect(stats).toBeInTheDocument();
    expect(screen.getByText('Engagements')).toBeInTheDocument();
    expect(screen.getByText('07')).toBeInTheDocument(); // zero-padded, per markup
    expect(screen.getByText('Open Findings')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Next Assessment')).toBeInTheDocument();
    expect(screen.getByText('14 days')).toBeInTheDocument(); // behaviour spec beats the prototype's `14d`

    // The four shortcut tiles.
    expect(screen.getByRole('link', { name: /Academy Progress/ })).toHaveAttribute(
      'href',
      '/portal/academy',
    );
    expect(screen.getByRole('link', { name: /Billing & Invoices/ })).toHaveAttribute(
      'href',
      '/portal/billing',
    );
    expect(screen.getByRole('link', { name: /Password Manager/ })).toHaveAttribute(
      'href',
      '/portal/security',
    );
    expect(screen.getByRole('link', { name: /Free Vulnerability Scanner/ })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('renders the initials avatar', async () => {
    renderPage();
    await screen.findByText('Jane Wanjiru');
    expect(document.querySelector('.vvp-avatar')).toHaveTextContent('JW');
  });
});

describe('Profile — form', () => {
  it('the work email is read-only and never part of the PATCH body', async () => {
    const user = userEvent.setup();
    renderPage();
    const email = await screen.findByLabelText('Work Email');
    expect(email).toHaveAttribute('readonly');
    expect(email).toHaveAttribute('aria-readonly', 'true');
    expect(email).toHaveValue(clientProfile.email);

    server.use(
      http.patch('*/api/v1/profile', async ({ request }) => {
        patchBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: clientProfile });
      }),
    );
    await user.type(screen.getByLabelText('Full Name'), 'X'); // make it dirty
    await user.click(screen.getByRole('button', { name: /Save Profile Settings/ }));
    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).not.toHaveProperty('email');
  });

  it('disables Save until the form is dirty', async () => {
    const user = userEvent.setup();
    renderPage();
    const save = await screen.findByRole('button', { name: /Save Profile Settings/ });
    const savePersonal = screen.getByRole('button', { name: /Save Personal Details/ });
    expect(save).toBeDisabled();
    expect(savePersonal).toBeDisabled();

    await user.type(screen.getByLabelText(/Role \/ Title/), ' ');
    expect(save).toBeEnabled();
    expect(savePersonal).toBeEnabled();
  });

  it('saves the UpdateProfileBody shape and flips the footer', async () => {
    const user = userEvent.setup();
    renderPage();
    server.use(
      http.patch('*/api/v1/profile', async ({ request }) => {
        patchBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          data: { ...clientProfile, fullName: 'Jane Wanjiru Kamau' },
        });
      }),
    );

    await screen.findByLabelText('Full Name');
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(screen.getByText('18 Aug 2026, 09:14 UTC')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Full Name'));
    await user.type(screen.getByLabelText('Full Name'), 'Jane Wanjiru Kamau');
    await user.clear(screen.getByLabelText('Phone Number'));
    await user.type(screen.getByLabelText('Phone Number'), '+254705998032');
    await user.selectOptions(screen.getByLabelText('Industry'), 'sacco_microfinance');
    await user.click(screen.getByRole('button', { name: /Save Profile Settings/ }));

    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).toEqual({
      fullName: 'Jane Wanjiru Kamau',
      jobTitle: 'Head of Information Security',
      phone: '+254705998032',
      company: {
        name: 'Acme Fintech Ltd',
        industry: 'sacco_microfinance',
      },
    });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Personal details saved',
        message: 'Your profile has been updated.',
      }),
    );
    expect(await screen.findByText('Last saved just now')).toBeInTheDocument();
  });

  it('splits the required-field copy per field', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Full Name');
    await user.clear(screen.getByLabelText('Full Name'));
    await user.clear(screen.getByLabelText(/Role \/ Title/));
    await user.click(screen.getByRole('button', { name: /Save Profile Settings/ }));
    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your job title.')).toBeInTheDocument();
    expect(patchBodies).toHaveLength(0);
  });

  it('maps a 400 validation_failed details onto the fields', async () => {
    server.use(
      http.patch('*/api/v1/profile', () =>
        HttpResponse.json(
          {
            error: 'validation_failed',
            details: [
              { path: ['company', 'name'], message: 'Too short' },
              { path: ['jobTitle'], message: 'Job title looks wrong' },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Full Name');
    await user.type(screen.getByLabelText(/Role \/ Title/), '!');
    await user.click(screen.getByRole('button', { name: /Save Profile Settings/ }));
    expect(await screen.findByText('Too short')).toBeInTheDocument();
    expect(screen.getByText('Job title looks wrong')).toBeInTheDocument();
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'crit',
      title: 'Could not save',
      message: 'Please try again.',
    });
  });

  it('the industry select lists the eleven contract labels behind the placeholder', async () => {
    renderPage();
    const select = await screen.findByLabelText('Industry');
    const options = Array.from(select.querySelectorAll('option'));
    expect(options).toHaveLength(12);
    expect(options[0]).toHaveTextContent('Select industry…');
    expect(options[1]).toHaveTextContent('Financial Services / Fintech');
    expect(options[11]).toHaveTextContent('Other');
    expect(select).toHaveValue('financial_services_fintech'); // the fixture's industry
  });
});

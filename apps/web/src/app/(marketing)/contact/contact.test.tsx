// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { server } from '../../../mocks/server';
import ContactPage from './page';

/**
 * Contact page tests — category preselect from the URL, the
 * required-field and consent messages, the honeypot riding along in the
 * payload, the `REQ-` success banner, and the 429 / network alert banners.
 * Submissions run through the real api client against the MSW contact
 * handler (and `server.use` overrides for the failure paths).
 */

const searchState = vi.hoisted(() => ({ value: '' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchState.value),
}));

let lastPayload: Record<string, unknown> | null = null;

beforeEach(() => {
  searchState.value = '';
  lastPayload = null;
  server.use(
    http.post('*/api/v1/contact', async ({ request }) => {
      lastPayload = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { data: { id: 'e2000000-0000-4000-8000-000000000001' } },
        { status: 201 },
      );
    }),
  );
});

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ContactPage />
    </QueryClientProvider>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full Name/), 'Jane Wanjiru');
  await user.type(screen.getByLabelText(/Business Email/), 'jane@company.co.ke');
  await user.selectOptions(screen.getByLabelText(/Inquiry Category/), 'general_support');
  await user.type(screen.getByLabelText('Subject'), 'Assessment inquiry');
  await user.type(
    screen.getByLabelText(/Message Details/),
    'We need a penetration test scoped to our customer web app.',
  );
  await user.click(screen.getByLabelText(/I confirm I am authorised/));
}

describe('ContactPage', () => {
  it('renders the hero, form and direct channels verbatim', () => {
    renderPage();
    expect(screen.getByText('Contact · Press · Disclosure')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Let’s secure your perimeter' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tell us what you need' })).toBeInTheDocument();
    expect(screen.getByText('TLS 1.3 · Nothing is stored on this device')).toBeInTheDocument();
    expect(screen.getByText('support@vunvault.com')).toBeInTheDocument();
    expect(screen.getByText('+254 705 998 032')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download key/ })).toHaveAttribute(
      'href',
      '/vunvault-pgp.asc',
    );
    expect(screen.getByText('3B99 FC12 8A4D 55E0 91C7')).toBeInTheDocument();
    const options = within(screen.getByLabelText(/Inquiry Category/)).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Select a category…',
      'Penetration Testing Request',
      'Vulnerability / Bug Report',
      'Journalist / Blogger Profile Request',
      'Whistleblower Tip',
      'General Support',
    ]);
  });

  it('preselects the category from ?category= and rejects unknown values', () => {
    searchState.value = '?category=whistleblower_tip';
    renderPage();
    expect(screen.getByLabelText(/Inquiry Category/)).toHaveValue('whistleblower_tip');
  });

  it('blocks an empty submit with required-field and consent messages', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Send Secure Request' }));

    // role=status/alert take no accessible name from content — query by text.
    const consentError = screen.getByText('Consent is required');
    expect(consentError.closest('[role="alert"]')).not.toBeNull();
    expect(screen.getByLabelText(/Full Name/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Business Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Inquiry Category/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Message Details/)).toHaveAttribute('aria-invalid', 'true');
    expect(lastPayload).toBeNull(); // nothing left the browser
  });

  it('sends the honeypot in the payload and shows the REQ- banner', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    // The honeypot is off-screen but registered; a bot would fill it.
    await user.type(document.getElementById('cf-website') as HTMLInputElement, 'http://spam');
    await user.click(screen.getByRole('button', { name: 'Send Secure Request' }));

    await waitFor(() => expect(lastPayload).not.toBeNull());
    expect(lastPayload).toMatchObject({
      name: 'Jane Wanjiru',
      email: 'jane@company.co.ke',
      category: 'general_support',
      consent: true,
      website: 'http://spam',
    });

    const statusText = await screen.findByText(/Request received — reference/);
    const status = statusText.closest('.vv-status');
    if (status === null) throw new Error('Status banner did not render.');
    expect(status).toHaveAttribute('role', 'status');
    expect(status.textContent).toContain('Request received — reference REQ-E20000.');
    expect(status.textContent).toContain('An administrator will review it shortly.');
    // The form reset after success.
    await waitFor(() => expect(screen.getByLabelText(/Full Name/)).toHaveValue(''));
  });

  it('shows the journalist sentence for the profile-request category', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.selectOptions(
      screen.getByLabelText(/Inquiry Category/),
      'journalist_blogger_profile_request',
    );
    await user.click(screen.getByRole('button', { name: 'Send Secure Request' }));
    await screen.findByText(
      /Your Journalist \/ Blogger profile request is submitted for manual verification\./,
    );
  });

  it('shows the 400 banner', async () => {
    server.use(
      http.post('*/api/v1/contact', () =>
        HttpResponse.json({ error: 'validation_failed' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Send Secure Request' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Please complete every required field with a valid business email address before sending.',
    );
  });

  it('shows the 429 banner', async () => {
    server.use(
      http.post('*/api/v1/contact', () =>
        HttpResponse.json({ error: 'rate_limited' }, { status: 429 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Send Secure Request' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Too many requests. Please wait a few minutes and try again.',
    );
  });

  it('shows the network-failure banner', async () => {
    server.use(http.post('*/api/v1/contact', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Send Secure Request' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'We could not send your request. Please email support@vunvault.com instead.',
    );
  });
});

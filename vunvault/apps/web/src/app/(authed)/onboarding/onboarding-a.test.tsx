// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@vunvault/contracts';
import { createQueryClient } from '@vunvault/lib';
import { server } from '../../../mocks/server';
import { OnboardingHero } from './_components/onboarding-hero';
import { OnboardingWizard } from './_components/onboarding-wizard';
import { useOnboardingStore } from './_store/onboarding-store';

/**
 * Onboarding wizard A tests (Task 64) — the verbatim hero + panel copy, the
 * session prefill, the under-16 DOB block, the email-match message, step 2's
 * blocked Continue until a career AND entity are chosen, the stepper state
 * after Back/Next (and the non-clickable future steps), and the completed
 * guard's redirect to `homeFor(role)`.
 *
 * `useSession` is module-mocked (the wizard is rendered without the authed
 * layout, so there is no session cookie to serve); the onboarding status
 * endpoint comes from this task's standing mock handler, with `server.use`
 * for the completed variant.
 */

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}));

const sessionUser = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('../../../lib/session', () => ({
  useSession: () => ({
    user: sessionUser.current,
    isLoading: false,
    isAuthenticated: sessionUser.current !== null,
    isStaff: false,
    can: () => false,
    refetch: () => undefined,
  }),
}));

const JANE: SessionUser = {
  id: 'd1000000-0000-4000-8000-000000000004',
  email: 'jane@example.com',
  fullName: 'Jane Wanjiru',
  role: 'client',
  orgId: null,
  permissions: [],
  mfaEnrolled: false,
};

let queryClient: QueryClient;

function renderWizard(withHero = false) {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {withHero ? <OnboardingHero /> : null}
      <OnboardingWizard />
    </QueryClientProvider>,
  );
}

/** Valid step-1 values (the session prefill already covers name + emails). */
async function completeStep1(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/Date of birth/), {
    target: { value: '1995-06-15' },
  });
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await screen.findByRole('heading', { name: 'How do you use VUNVAULT?' });
}

beforeEach(() => {
  routerReplace.mockClear();
  sessionUser.current = JANE;
  useOnboardingStore.setState({ step: 1 });
});

describe('Onboarding — hero copy', () => {
  it('renders the eyebrow, title, sub and the three meta chips verbatim', () => {
    renderWizard(true);
    expect(screen.getByText('Account setup · 3 steps')).toBeInTheDocument();
    expect(screen.getByText("Let's finish setting up", { exact: false })).toBeInTheDocument();
    expect(screen.getByText('your VUNVAULT workspace.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tell us who you are and how you work. This information shapes your scan scope, your compliance mapping and the reporting format you receive. It takes about two minutes — and nothing is shared outside VUNVAULT.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('256-bit encrypted submission')).toBeInTheDocument();
    expect(screen.getByText('~2 minutes to complete')).toBeInTheDocument();
    expect(screen.getByText('GDPR & DPA 2019 aligned')).toBeInTheDocument();
  });
});

describe('Onboarding — step 1 (personal & contact)', () => {
  it('renders the panel copy, fields and hints verbatim', () => {
    renderWizard();
    expect(screen.getByText('Step 01 — Personal & contact')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who are we protecting?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Use the name and contact details you want attached to your security reports. We use your email for scan notifications and your phone for critical alerts only.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('placeholder', 'Jane Wanjiru Kamau');
    expect(screen.getByText('You must be at least 16 years old.')).toBeInTheDocument();
    expect(screen.getByText('Include your country code for SMS alerts.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm email address/)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete Setup/ })).not.toBeInTheDocument();
  });

  it('prefills fullName, email and emailConfirm from the session', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveValue('Jane Wanjiru'));
    expect(screen.getByLabelText(/^Email address/)).toHaveValue('jane@example.com');
    expect(screen.getByLabelText(/Confirm email address/)).toHaveValue('jane@example.com');
  });

  it('blocks an under-16 date of birth with the verbatim message', async () => {
    const user = userEvent.setup();
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveValue('Jane Wanjiru'));
    fireEvent.change(screen.getByLabelText(/Date of birth/), {
      target: { value: '2015-01-01' },
    });
    await user.click(screen.getByRole('button', { name: /Next/ }));
    // The hint and the error share the verbatim copy — assert the error slot.
    const dobError = document.getElementById('obDobError');
    await waitFor(() => expect(dobError).toHaveTextContent('You must be at least 16 years old.'));
    expect(dobError).toHaveClass('is-visible');
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText(/Date of birth/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks a mismatched confirm email with the verbatim message', async () => {
    const user = userEvent.setup();
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveValue('Jane Wanjiru'));
    fireEvent.change(screen.getByLabelText(/Date of birth/), {
      target: { value: '1995-06-15' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm email address/), {
      target: { value: 'someone.else@example.com' },
    });
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Email addresses must match.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 is valid', async () => {
    const user = userEvent.setup();
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveValue('Jane Wanjiru'));
    await completeStep1(user);
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
  });
});

describe('Onboarding — step 2 (career & entity)', () => {
  it('stays put until BOTH a career and an entity are chosen', async () => {
    const user = userEvent.setup();
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveValue('Jane Wanjiru'));
    await completeStep1(user);

    expect(screen.getByText('Step 02 — Career & account type')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How do you use VUNVAULT?' })).toBeInTheDocument();
    // The four careers + three entities, with the contract copy.
    for (const label of [
      'Student',
      'Business Owner',
      'Cybersecurity Professional',
      'Independent Specialist',
    ]) {
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByText('Learning tracks, labs and free certificates.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Select what best describes you.')).toBeInTheDocument();
    expect(screen.getByText('Select an account entity.')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Student/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() =>
      expect(screen.queryByText('Select what best describes you.')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Select an account entity.')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Individual/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete Setup/ })).toBeInTheDocument();
  });
});

describe('Onboarding — stepper', () => {
  it('tracks Back/Next with is-done/is-active and clickable previous steps', async () => {
    const user = userEvent.setup();
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveValue('Jane Wanjiru'));

    const progress = screen.getByRole('list', { name: 'Onboarding progress' });
    // Step 1: nothing is clickable yet (no previous steps).
    expect(within(progress).queryByRole('button')).not.toBeInTheDocument();
    expect(progress.querySelector('.ob-stepper-item.is-active')?.textContent).toContain(
      'Personal & contact',
    );

    await completeStep1(user);
    const doneItem = progress.querySelector('.ob-stepper-item.is-done');
    expect(doneItem?.textContent).toContain('Personal & contact');
    const backButton = within(progress).getByRole('button', {
      name: 'Go back to step 1: Personal & contact',
    });
    expect(progress.querySelector('.ob-stepper-item.is-active')?.textContent).toContain(
      'Career & account type',
    );
    expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Career & account type',
    );

    // Clicking the previous step goes back.
    await user.click(backButton);
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who are we protecting?' })).toBeInTheDocument();

    // Forward again via Next, then Back via the action-bar button.
    await completeStep1(user);
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
  });
});

describe('Onboarding — completed guard', () => {
  it('redirects a completed profile to homeFor(role)', async () => {
    server.use(
      http.get('*/api/v1/onboarding', () =>
        HttpResponse.json({ data: { completed: true, completedAt: '2026-09-01T10:00:00Z' } }),
      ),
    );
    renderWizard();
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/portal'));
  });
});

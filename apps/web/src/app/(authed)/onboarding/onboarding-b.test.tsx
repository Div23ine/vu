// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingSubmitBody, type SessionUser } from '@vunvault/contracts';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../mocks/server';
import { OnboardingWizard } from './_components/onboarding-wizard';
import { useOnboardingStore } from './_store/onboarding-store';

/**
 * Onboarding wizard B tests — step 3's verbatim copy and question
 * list, the blocked submit until ALL three declarations are checked, the
 * exact `OnboardingSubmitBody` wire shape, the success view (toast, name,
 * redirect after the 2.2 s bar), the 409/422/400 error choreography
 * (navigate / jump to step 1 with the field error / map `details` paths and
 * jump to the first failing step), the network-failure toast, and the
 * privacy rule: the recovery answer is cleared the moment the submit
 * succeeds.
 *
 * Fake timers + `fireEvent` — the harness pattern an earlier iteration/62 established.
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

/** The redirect bar's length (matches `obFill` / SUCCESS_REDIRECT_MS). */
const SUCCESS_REDIRECT_MS = 2200;

let queryClient: QueryClient;
let postCalls = 0;
let lastBody: unknown = null;

function renderWizard() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingWizard />
    </QueryClientProvider>,
  );
}

async function flush(ms = 20) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Steps 1 → 3 with valid values (session prefill covers name + emails). */
async function advanceToStep3() {
  fireEvent.change(screen.getByLabelText(/Date of birth/), {
    target: { value: '1995-06-15' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  await flush();
  fireEvent.click(screen.getByRole('radio', { name: /Student/ }));
  fireEvent.click(screen.getByRole('radio', { name: /Individual/ }));
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  await flush();
  // Fake timers: no findBy*/waitFor (RTL polls with faked intervals) — flush,
  // then assert synchronously (the mfa/signup-b harness pattern).
  screen.getByRole('heading', { name: 'Confirm and secure your account' });
}

function fillStep3(answer = 'Fluffy') {
  fireEvent.change(screen.getByLabelText(/Account recovery question/), {
    target: { value: 'first_pet' },
  });
  fireEvent.change(screen.getByLabelText(/Recovery answer/), { target: { value: answer } });
}

function checkAllDeclarations() {
  for (const box of screen.getAllByRole('checkbox')) {
    fireEvent.click(box);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  routerReplace.mockClear();
  sessionUser.current = JANE;
  useToastStore.setState({ toasts: [] });
  useOnboardingStore.setState({ step: 1 });
  postCalls = 0;
  lastBody = null;
  server.use(
    http.post('*/api/v1/onboarding', async ({ request }) => {
      postCalls += 1;
      lastBody = await request.json().catch(() => null);
      return HttpResponse.json(
        { data: { completed: true, completedAt: '2026-10-08T10:00:00Z' } },
        { status: 201 },
      );
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Onboarding B — step 3 copy', () => {
  it('renders the panel, the five verbatim questions and the declarations', async () => {
    renderWizard();
    await flush();
    await advanceToStep3();

    expect(screen.getByText('Step 03 — Verification & finalisation')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Review what we captured, answer one account-recovery question, and confirm the declarations below. Your recovery answer is hashed locally — we never store it in plain text.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Captured details')).toBeInTheDocument();
    expect(screen.getByText('Jane Wanjiru')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ready to submit')).toBeInTheDocument();
    expect(
      screen.getByText('Case-insensitive. Keep it something only you would know.'),
    ).toBeInTheDocument();

    const select = screen.getByLabelText(/Account recovery question/);
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.map((option) => option.textContent)).toEqual([
      'Choose a recovery question…',
      'What was the name of your first pet?',
      'In what city were you born?',
      "What is your mother's maiden name?",
      'What was your first car?',
      'What was the name of your first school?',
    ]);

    expect(
      screen.getByText(
        'I confirm that the personal, contact and entity information I provided is accurate, current and belongs to me or to an organisation I am authorised to represent.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('button', { name: /Complete Setup/ })).toBeInTheDocument();
  });
});

describe('Onboarding B — declarations gate', () => {
  it('blocks the submit until ALL three declarations are checked', async () => {
    renderWizard();
    await flush();
    await advanceToStep3();
    fillStep3();

    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();
    expect(screen.getAllByText('You must accept this declaration to continue.')).toHaveLength(3);
    expect(postCalls).toBe(0);

    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0] as HTMLElement);
    fireEvent.click(boxes[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();
    expect(postCalls).toBe(0);

    fireEvent.click(boxes[2] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();
    expect(postCalls).toBe(1);
  });

  it('enforces the contract minimum on the recovery answer', async () => {
    renderWizard();
    await flush();
    await advanceToStep3();
    fillStep3('ab');
    checkAllDeclarations();
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();
    expect(screen.getByText('String must contain at least 3 character(s)')).toBeInTheDocument();
    expect(postCalls).toBe(0);
  });

  it('requires a recovery question', async () => {
    renderWizard();
    await flush();
    await advanceToStep3();
    fireEvent.change(screen.getByLabelText(/Recovery answer/), {
      target: { value: 'Fluffy' },
    });
    checkAllDeclarations();
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();
    expect(
      screen.getByText('Choose a recovery question…', { selector: '.ob-err' }),
    ).toBeInTheDocument();
    expect(postCalls).toBe(0);
  });
});

describe('Onboarding B — submit body and success', () => {
  it('posts exactly the OnboardingSubmitBody shape', async () => {
    renderWizard();
    await flush();
    await advanceToStep3();
    fillStep3();
    checkAllDeclarations();
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();

    expect(postCalls).toBe(1);
    const parsed = OnboardingSubmitBody.safeParse(lastBody);
    expect(parsed.success).toBe(true);
    expect(lastBody).toMatchObject({
      step1: {
        fullName: 'Jane Wanjiru',
        dateOfBirth: '1995-06-15',
        email: 'jane@example.com',
        emailConfirm: 'jane@example.com',
      },
      step2: { career: 'student', entity: 'individual' },
      step3: {
        recoveryQuestion: 'first_pet',
        recoveryAnswer: 'Fluffy',
        declarations: { infoAccurate: true, authorisedTesting: true, termsAccepted: true },
      },
    });
    // The empty phone sentinel never reaches the wire.
    expect((lastBody as { step1: { phone?: unknown } }).step1.phone).toBeUndefined();
  });

  it('shows the success view, clears the answer, toasts and redirects after the bar', async () => {
    renderWizard();
    await flush();
    await advanceToStep3();
    fillStep3();
    checkAllDeclarations();
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();

    // Privacy: the answer is cleared the moment the submit succeeds (the
    // panel is hidden, not unmounted — the design's [hidden] pattern).
    expect(screen.getByLabelText(/Recovery answer/)).toHaveValue('');

    expect(document.getElementById('obSuccess')).not.toHaveAttribute('hidden');
    expect(screen.getByRole('heading', { name: 'Onboarding complete' })).toBeInTheDocument();
    expect(screen.getByText('Welcome aboard,', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(
      screen.getByText(
        '. Your VUNVAULT profile has been created and verified. Taking you back to the main platform…',
        { exact: false },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Redirecting to /portal')).toBeInTheDocument();
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Profile complete',
      message: 'Welcome to your VUNVAULT workspace.',
    });

    expect(routerReplace).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUCCESS_REDIRECT_MS);
    });
    expect(routerReplace).toHaveBeenCalledWith('/portal');
  });
});

describe('Onboarding B — error choreography', () => {
  async function submitFromStep3() {
    renderWizard();
    await flush();
    await advanceToStep3();
    fillStep3();
    checkAllDeclarations();
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));
    await flush();
  }

  it('409 already_completed navigates to /portal', async () => {
    server.use(
      http.post('*/api/v1/onboarding', () =>
        HttpResponse.json({ error: 'already_completed' }, { status: 409 }),
      ),
    );
    await submitFromStep3();
    expect(routerReplace).toHaveBeenCalledWith('/portal');
    // The success view stays mounted but hidden (the design's [hidden] pattern).
    expect(document.getElementById('obSuccess')).toHaveAttribute('hidden');
  });

  it('422 email_mismatch jumps to step 1 with the field error', async () => {
    server.use(
      http.post('*/api/v1/onboarding', () =>
        HttpResponse.json({ error: 'email_mismatch' }, { status: 422 }),
      ),
    );
    await submitFromStep3();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(
      screen.getByText('Email must match the address you signed up with.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email address/)).toHaveAttribute('aria-invalid', 'true');
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('400 validation_failed maps the details paths and jumps to the first failing step', async () => {
    server.use(
      http.post('*/api/v1/onboarding', () =>
        HttpResponse.json(
          {
            error: 'validation_failed',
            details: [
              { path: ['step3', 'recoveryAnswer'], message: 'Too short.' },
              { path: ['step2', 'career'], message: 'Career is required.' },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    await submitFromStep3();
    // step2 sorts before step3 — the wizard lands on step 2.
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Career is required.')).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('a network failure toasts the verbatim retry copy', async () => {
    server.use(http.post('*/api/v1/onboarding', () => HttpResponse.error()));
    await submitFromStep3();
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'crit',
      title: 'Could not save your profile',
      message: 'Please try again.',
    });
    expect(document.getElementById('obSuccess')).toHaveAttribute('hidden');
    expect(routerReplace).not.toHaveBeenCalled();
  });
});

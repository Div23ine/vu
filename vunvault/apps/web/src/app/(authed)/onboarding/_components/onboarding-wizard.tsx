'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import {
  CAREER_LABELS,
  E164_PATTERN,
  EMAIL_MATCH_MESSAGE,
  ENTITY_LABELS,
  isAtLeast16,
  MIN_AGE_MESSAGE,
  RECOVERY_QUESTION_LABELS,
  type CareerRole,
  type EntityType,
  type OnboardingStatus,
  type RecoveryQuestion,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { apiGet } from '../../../../lib/api';
import { homeFor } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { useOnboardingStore, type WizardStep } from '../_store/onboarding-store';
import { toSubmitBody, useSubmitOnboarding } from '../_hooks/use-submit-onboarding';
import '../_styles/onboarding.css';
import { StepFinal } from './step-final';
import { StepPersonal } from './step-personal';
import { StepProfile } from './step-profile';
import { Stepper } from './stepper';

/**
 * Onboarding wizard (Task 64; Task 65 wires step 3 and the submit) — ONE
 * `useForm` for the whole three-step flow (`mode: "onTouched"`); each step
 * validates ONLY its own field paths with `trigger([...])` before `Next`
 * advances. RHF holds the values; the store holds the step.
 *
 * The form schema mirrors `OnboardingSubmitBody` from the contracts:
 *  - step 1 uses the contract's own messages verbatim (`MIN_AGE_MESSAGE`,
 *    `EMAIL_MATCH_MESSAGE`, the E.164 hint); the phone field additionally
 *    accepts `''` because an untouched optional input registers an empty
 *    string, which the raw regex would reject;
 *  - step 2 carries the planner's required copy (`Select what best describes
 *    you.` / `Select an account entity.`) over the enum fields;
 *  - step 3 (Task 65) keeps the contract's answer rule (min 3, default
 *    message) and adds the planner's declaration copy (`You must accept this
 *    declaration to continue.`); the question's required message reuses the
 *    select's own placeholder — the planner pinned no separate copy.
 *
 * Submit (Task 65): `POST /api/v1/onboarding` with the whole body — `201`
 * clears the recovery answer (privacy: sent once, never kept), toasts
 * `Profile complete`, invalidates `queryKeys.profile()` + `queryKeys.session()`
 * and shows the reference success view while the redirect bar runs (2.2 s,
 * matching the `obFill` animation; instant under reduced motion) before
 * `router.replace("/portal")`. `409 already_completed` → straight to
 * `/portal`; `422 email_mismatch` → the field error on step 1's email plus a
 * jump back to step 1; `400 validation_failed` → the Zod `details` paths map
 * onto fields and the wizard jumps to the FIRST step containing an error;
 * anything else toasts `Could not save your profile`.
 *
 * Guard: `GET /api/v1/onboarding` — a completed profile redirects to
 * `homeFor(role)`; staff never reach this page (the layout redirects them to
 * `/admin` server-side).
 *
 * Step changes move focus to the panel heading and scroll the wizard top into
 * view (`block: "start"`, smooth — instant under `prefers-reduced-motion`).
 */

/** The contract's phone message, verbatim (inlined in `OnboardingStep1`). */
const PHONE_MESSAGE = 'Use the international form, e.g. +254712345678';
const DECLARATION_MESSAGE = 'You must accept this declaration to continue.';
const QUESTION_MESSAGE = 'Choose a recovery question…';
/** Matches the `obFill` redirect-bar animation (reference CSS). */
const SUCCESS_REDIRECT_MS = 2200;

const CAREER_VALUES = Object.keys(CAREER_LABELS) as [CareerRole, ...CareerRole[]];
const ENTITY_VALUES = Object.keys(ENTITY_LABELS) as [EntityType, ...EntityType[]];
const QUESTION_VALUES = Object.keys(RECOVERY_QUESTION_LABELS) as [
  RecoveryQuestion,
  ...RecoveryQuestion[],
];

const step1FormSchema = z
  .object({
    fullName: z.string().min(2),
    dateOfBirth: z
      .string()
      .date()
      .refine((value) => isAtLeast16(value), MIN_AGE_MESSAGE),
    phone: z.union([z.literal(''), z.string().regex(E164_PATTERN, PHONE_MESSAGE)]).optional(),
    email: z.string().email(),
    emailConfirm: z.string().email(),
  })
  .refine((value) => value.email === value.emailConfirm, {
    path: ['emailConfirm'],
    message: EMAIL_MATCH_MESSAGE,
  });

const step2FormSchema = z.object({
  career: z.enum(CAREER_VALUES, {
    required_error: 'Select what best describes you.',
    invalid_type_error: 'Select what best describes you.',
  }),
  entity: z.enum(ENTITY_VALUES, {
    required_error: 'Select an account entity.',
    invalid_type_error: 'Select an account entity.',
  }),
});

const declarationSchema = z.boolean().refine((value) => value, {
  message: DECLARATION_MESSAGE,
});

const step3FormSchema = z.object({
  recoveryQuestion: z
    .union([z.literal(''), z.enum(QUESTION_VALUES)])
    .refine((value) => value !== '', { message: QUESTION_MESSAGE }),
  recoveryAnswer: z.string().min(3),
  declarations: z.object({
    infoAccurate: declarationSchema,
    authorisedTesting: declarationSchema,
    termsAccepted: declarationSchema,
  }),
});

export const onboardingFormSchema = z.object({
  step1: step1FormSchema,
  step2: step2FormSchema,
  step3: step3FormSchema,
});

export type OnboardingFormValues = z.input<typeof onboardingFormSchema>;

const STEP1_FIELDS = [
  'step1.fullName',
  'step1.dateOfBirth',
  'step1.phone',
  'step1.email',
  'step1.emailConfirm',
] as const;
const STEP2_FIELDS = ['step2.career', 'step2.entity'] as const;

/** `Jane Wanjiru Kamau` → `Jane`; the prototype's placeholder covers the rest. */
function firstNameFrom(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first === undefined || first === '' ? 'friend' : first;
}

export function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const step = useOnboardingStore((state) => state.step);
  const setStep = useOnboardingStore((state) => state.setStep);
  const resetStore = useOnboardingStore((state) => state.reset);
  const shellRef = useRef<HTMLDivElement>(null);
  const submit = useSubmitOnboarding();
  const [succeeded, setSucceeded] = useState(false);
  const [successName, setSuccessName] = useState('friend');

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    mode: 'onTouched',
    defaultValues: {
      step1: { fullName: '', dateOfBirth: '', phone: '', email: '', emailConfirm: '' },
      step2: { career: undefined, entity: undefined },
      step3: {
        recoveryQuestion: '',
        recoveryAnswer: '',
        declarations: { infoAccurate: false, authorisedTesting: false, termsAccepted: false },
      },
    },
  });
  const { trigger, handleSubmit, setError, setValue, getValues } = form;

  // TODO(backend-contract): GET /api/v1/onboarding → 200 { data: { completed; completedAt } }
  const status = useQuery({
    // Authored key (the lib's factory has no onboarding entry and Task 64 may
    // not modify it): scoped under its own root so it stays invalidatable.
    queryKey: ['onboarding', 'status'],
    queryFn: () =>
      apiGet<{ data: OnboardingStatus }>('/api/v1/onboarding').then((response) => response.data),
  });

  // A fresh mount always starts at step 1 — the form state is new, so a step
  // left over in the store from a previous visit would desync the two.
  useEffect(() => {
    resetStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  // Prefill from the session (spec): fullName, email and emailConfirm — only
  // while the fields are still untouched/empty, and only once.
  const prefilled = useRef(false);
  useEffect(() => {
    if (user === null || prefilled.current) return;
    prefilled.current = true;
    if (getValues('step1.fullName') === '') setValue('step1.fullName', user.fullName);
    if (getValues('step1.email') === '') {
      setValue('step1.email', user.email);
      setValue('step1.emailConfirm', user.email);
    }
  }, [user, getValues, setValue]);

  // Guard: completed profiles go home; the layout keeps staff away.
  useEffect(() => {
    if (status.data?.completed !== true) return;
    router.replace(homeFor(user?.role ?? 'client'));
  }, [status.data, router, user]);

  // Focus + scroll on step CHANGE (not on the first render).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    shellRef.current?.querySelector<HTMLElement>('.ob-panel-title')?.focus();
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof shellRef.current?.scrollIntoView === 'function') {
      shellRef.current.scrollIntoView({
        block: 'start',
        behavior: reduced ? 'instant' : 'smooth',
      });
    }
  }, [step]);

  // Success view: the redirect bar runs, then the router replaces to /portal
  // (instant under reduced motion — the same rule the bar's CSS follows).
  useEffect(() => {
    if (!succeeded) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => router.replace('/portal'), reduced ? 0 : SUCCESS_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [succeeded, router]);

  const goNext = useCallback(async () => {
    const fields = step === 1 ? STEP1_FIELDS : STEP2_FIELDS;
    const ok = await trigger([...fields]);
    if (ok) setStep((step + 1) as WizardStep);
  }, [setStep, step, trigger]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((step - 1) as WizardStep);
  }, [setStep, step]);

  const navigateTo = useCallback(
    (target: WizardStep) => {
      if (target < step) setStep(target);
    },
    [setStep, step],
  );

  /** Map a `400 validation_failed` envelope's Zod issues onto form fields. */
  const applyValidationDetails = useCallback(
    (details: unknown[]): WizardStep | null => {
      let firstStep: WizardStep | null = null;
      for (const detail of details) {
        const issue = detail as { path?: unknown; message?: unknown };
        if (!Array.isArray(issue.path) || typeof issue.message !== 'string') continue;
        const [head, ...rest] = issue.path;
        if (rest.length === 0) continue;
        if (head !== 'step1' && head !== 'step2' && head !== 'step3') continue;
        setError(`${head}.${rest.join('.')}` as Path<OnboardingFormValues>, {
          message: issue.message,
        });
        const stepNo: WizardStep = head === 'step1' ? 1 : head === 'step2' ? 2 : 3;
        if (firstStep === null || stepNo < firstStep) firstStep = stepNo;
      }
      return firstStep;
    },
    [setError],
  );

  const onSubmit = handleSubmit(async (values) => {
    try {
      await submit.mutateAsync(toSubmitBody(values));
    } catch (submitError) {
      if (isApiError(submitError) && submitError.status === 409) {
        router.replace('/portal');
        return;
      }
      if (isApiError(submitError) && submitError.status === 422) {
        setError('step1.email', { message: 'Email must match the address you signed up with.' });
        setStep(1);
        return;
      }
      if (
        isApiError(submitError) &&
        submitError.status === 400 &&
        Array.isArray(submitError.details)
      ) {
        const firstStep = applyValidationDetails(submitError.details);
        if (firstStep !== null) {
          setStep(firstStep);
          return;
        }
      }
      toast({
        kind: 'crit',
        title: 'Could not save your profile',
        message: 'Please try again.',
      });
      return;
    }

    // 201 — privacy first: the recovery answer is cleared the moment the
    // submit settles; it is never echoed, logged or kept.
    setValue('step3.recoveryAnswer', '');
    setSuccessName(firstNameFrom(getValues('step1.fullName')));
    setSucceeded(true);
    toast({
      kind: 'ok',
      title: 'Profile complete',
      message: 'Welcome to your VUNVAULT workspace.',
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
  });

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="ob-shell" id="obShell" ref={shellRef}>
        <Stepper step={step} onNavigate={navigateTo} />
        <form id="onboardingForm" autoComplete="on" onSubmit={onSubmit} noValidate>
          <div hidden={succeeded}>
            {step === 1 ? <StepPersonal form={form} /> : null}
            {step === 2 ? <StepProfile form={form} /> : null}
            {step === 3 ? <StepFinal form={form} /> : null}
          </div>

          <section
            className="ob-success"
            id="obSuccess"
            hidden={!succeeded}
            aria-labelledby="obSuccessTitle"
          >
            <div className="ob-success-mark" aria-hidden="true">
              <Check size={38} />
            </div>
            <h2 className="ob-success-title" id="obSuccessTitle">
              Onboarding complete
            </h2>
            <p className="ob-success-text">
              Welcome aboard, <strong id="obSuccessName">{successName}</strong>. Your VUNVAULT
              profile has been created and verified. Taking you back to the main platform…
            </p>
            <div className="ob-redirect-bar" aria-hidden="true">
              <span />
            </div>
            <p className="ob-redirect-note">Redirecting to /portal</p>
          </section>

          <div className="ob-actions" id="obActions" hidden={succeeded}>
            {step > 1 ? (
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                id="obPrevBtn"
                onClick={goBack}
              >
                <ArrowLeft aria-hidden="true" />
                <span>Back</span>
              </button>
            ) : null}
            <span className="ob-progress-text" id="obProgressText">
              Step {step} of 3
            </span>
            {step < 3 ? (
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                id="obNextBtn"
                onClick={() => void goNext()}
              >
                <span>Next</span>
                <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                className={cn('ob-btn ob-btn--primary', submit.isPending && 'is-busy')}
                id="obSubmitBtn"
                disabled={submit.isPending}
                aria-busy={submit.isPending}
              >
                <span>Complete Setup</span>
                {submit.isPending ? (
                  <span className="ob-spinner" aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

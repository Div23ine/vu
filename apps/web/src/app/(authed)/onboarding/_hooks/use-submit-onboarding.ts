import { useMutation } from '@tanstack/react-query';
import type { OnboardingSubmitBody } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';
import type { OnboardingFormValues } from '../_components/onboarding-wizard';

/**
 * Onboarding submission — posts the whole wizard as one
 * `OnboardingSubmitBody` and maps the form's tolerant input types onto the
 * contract (the empty-string sentinels the controlled inputs use become the
 * contract's `undefined` / literal-`true` members; the resolver has already
 * proven every declaration is `true` and the question is a real enum member
 * by the time this runs).
 *
 * No `'use client'` directive (the directive-free hook-module pattern): only ever called
 * from the client wizard, which pulls this module into its bundle.
 */

export function useSubmitOnboarding() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/onboarding body { step1; step2; step3 }
    //  → 201 { data: { completed: true; completedAt: string } } | 400 validation_failed
    //  | 409 { error: "already_completed" } | 422 { error: "email_mismatch" }
    mutationFn: (body: OnboardingSubmitBody) =>
      apiPost<{ data: { completed: true; completedAt: string } }>('/api/v1/onboarding', body).then(
        (response) => response.data,
      ),
  });
}

/** Form values → the exact contract body (validated values only). */
export function toSubmitBody(values: OnboardingFormValues): OnboardingSubmitBody {
  const question = values.step3.recoveryQuestion;
  if (question === '') {
    // Unreachable after the resolver ran — guard the type narrowing only.
    throw new Error('toSubmitBody requires a validated recovery question');
  }
  const phone = values.step1.phone ?? '';
  return {
    step1: {
      fullName: values.step1.fullName,
      dateOfBirth: values.step1.dateOfBirth,
      phone: phone === '' ? undefined : phone,
      email: values.step1.email,
      emailConfirm: values.step1.emailConfirm,
    },
    step2: { career: values.step2.career, entity: values.step2.entity },
    step3: {
      recoveryQuestion: question,
      recoveryAnswer: values.step3.recoveryAnswer,
      declarations: { infoAccurate: true, authorisedTesting: true, termsAccepted: true },
    },
  };
}

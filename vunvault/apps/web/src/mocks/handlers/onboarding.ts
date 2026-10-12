import { http, HttpResponse } from 'msw';
import { OnboardingSubmitBody } from '@vunvault/contracts';

/**
 * Onboarding mock handlers (Task 64).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. The standing GET answers "not completed" so the wizard is reachable
 * in dev; tests that need the completed-guard use `server.use` overrides.
 *
 * DISCLOSED (created ahead of its owner, the mfa-dialog-store precedent):
 * the POST is Task 65's endpoint, but Task 65's deliverables list no mock
 * file — registering it here keeps the browser demo of the submit flow
 * functional and the aggregated handler list honest. It validates with the
 * real `OnboardingSubmitBody` (400 `validation_failed` with the Zod issues as
 * `details`, exactly like the API) and answers the 201 completion shape.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 30):
 *   GET  /api/v1/onboarding → 200 { data: { completed: boolean; completedAt: string | null } }
 *   POST /api/v1/onboarding body { step1; step2; step3 }
 *     → 201 { data: { completed: true; completedAt } } | 400 validation_failed
 *     | 409 { error: "already_completed" } | 422 { error: "email_mismatch" }
 */

export const onboardingHandlers = [
  http.get('*/api/v1/onboarding', () =>
    HttpResponse.json({ data: { completed: false, completedAt: null } }),
  ),

  http.post('*/api/v1/onboarding', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = OnboardingSubmitBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    return HttpResponse.json(
      { data: { completed: true, completedAt: new Date().toISOString() } },
      { status: 201 },
    );
  }),
];

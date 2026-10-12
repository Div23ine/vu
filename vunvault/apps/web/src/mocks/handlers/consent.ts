import { http, HttpResponse } from 'msw';
import { ConsentBody } from '@vunvault/contracts';

/**
 * Consent mock handler (Task 58).
 *
 *   POST /api/v1/consent → 204 | 400 validation_failed
 *
 * Mirrors the real public route (Task 40): `optionalAuth` (never rejects),
 * the contract body, and an empty 204. Rate limiting (429) is exercised in
 * tests via `server.use` overrides. The real route does NOT yet set the
 * readable `vv_consent=1` cookie — noted as a backend follow-up in the task
 * report.
 */
export const consentHandlers = [
  http.post('*/api/v1/consent', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = ConsentBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

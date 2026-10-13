import { http, HttpResponse } from 'msw';
import { NewsletterSubscribeBody } from '@vunvault/contracts';

/**
 * Newsletter mock handler (Task 56).
 *
 *   POST /api/v1/newsletter → 202 {} | 400 validation_failed
 *
 * The real endpoint (Task 40c) records the address and sends the double
 * opt-in confirmation; it NEVER reveals whether the address already existed,
 * and neither does this mock — every valid body answers an identical 202.
 */
export const newsletterHandlers = [
  http.post('*/api/v1/newsletter', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = NewsletterSubscribeBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    return HttpResponse.json({}, { status: 202 });
  }),
];

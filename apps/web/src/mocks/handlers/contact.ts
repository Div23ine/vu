import { http, HttpResponse } from 'msw';
import { ContactBody } from '@vunvault/contracts';
import { z } from 'zod';

/**
 * Contact mock handler .
 *
 * POST /api/v1/contact → 201 { data: { id } } | 400 validation_failed
 *
 * Mirrors the real public route exactly, including the honeypot contract: a
 * filled `website` field answers 201 with a throwaway id and stores nothing —
 * the bot sees success, the queue does not. Rate limiting (429) is exercised
 * in tests via `server.use` overrides rather than simulated here.
 */

/** The API's `ContactBodyWithBotFields`: contract + the two bot fields. */
const ContactBodyWithBotFields = ContactBody.extend({
  website: z.string().max(200).optional(),
  turnstileToken: z.string().optional(),
});

let issued = 0;

function nextId(): string {
  issued += 1;
  return `e2000000-0000-4000-8000-${String(issued).padStart(12, '0')}`;
}

export const contactHandlers = [
  http.post('*/api/v1/contact', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = ContactBodyWithBotFields.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    // Honeypot filled → silent success, nothing stored (real API parity).
    if (parsed.data.website !== undefined && parsed.data.website.trim() !== '') {
      return HttpResponse.json({ data: { id: nextId() } }, { status: 201 });
    }
    return HttpResponse.json({ data: { id: nextId() } }, { status: 201 });
  }),
];

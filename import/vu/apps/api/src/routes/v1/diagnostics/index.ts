import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audited } from '../../../audit/audited.js';
import { HttpError } from '../../../lib/http-error.js';

/**
 * Email-delivery diagnostics (Revision 2 addendum, A2.4).
 *
 * WHY THIS EXISTS
 * ---------------
 * The reported failure was "the UI says the email was sent, nothing arrived, and
 * the Resend dashboard shows no send event". Every layer between the button and
 * the mailbox could be at fault, and none of them was observable from outside the
 * process. This endpoint removes the guesswork: a super admin names an address,
 * the API performs one real send through the production provider, and the RAW
 * Resend id comes back in the response. That id is the join key to the Resend
 * dashboard — if it is present there, delivery is Resend's problem; if the call
 * throws, the fault is ours and the error is in the log.
 *
 * ACCESS
 * ------
 * Super admin only, and deliberately so: this route can make the platform send
 * mail to an arbitrary address, which is an abuse vector if it leaks. It is
 * therefore behind the full admin guard stack (`authenticate` → `requireStaff`
 * (aal2) → `requirePermission('users:manage')` → `requireRole('super_admin')`),
 * rate-limited on the `sensitive` policy, and every use is written to the sealed
 * audit chain as `EMAIL_DELIVERY_TEST`.
 *
 * `users:manage` is reused rather than inventing a `diagnostics:*` permission:
 * Task 19 declares `PERMISSIONS` as an exact list, and Task 40's conformance
 * suite requires a permission guard on every `/api/v1/admin/*` route. Adding a
 * permission string would have been a contract change nobody asked for.
 */

const EmailTestBody = z.object({
  /** Destination for the test message. Any address — that is the point of the tool. */
  to: z.string().email().max(254),
  /** Optional subject override, so a test can be recognised in a busy inbox. */
  subject: z.string().min(1).max(200).optional(),
});

const EmailTestResponse = z.object({
  data: z.object({
    /** The raw Resend id — search the dashboard's Emails/Logs tab for exactly this. */
    id: z.string(),
    /** HTTP status Resend answered with (200 on the success path). */
    status: z.number().int(),
    /** Where the store stood at boot, so a result is never read out of context. */
    store: z.enum(['redis', 'memory']),
  }),
});

type EmailTestResult = z.infer<typeof EmailTestResponse>;

export interface DiagnosticsRoutesOptions {
  /** Test seam: inject a provider instead of using `app.email`. */
  send?: (to: string, subject: string, requestId: string) => Promise<{ id: string }>;
}

const diagnosticsRoutes: FastifyPluginAsync<DiagnosticsRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  const guard = [
    app.authenticate,
    app.requireStaff,
    app.requirePermission('users:manage'),
    app.requireRole('super_admin'),
  ];

  app.post(
    '/admin/diagnostics/email-test',
    {
      preHandler: guard,
      config: { rateLimitPolicy: 'sensitive' },
      schema: { body: EmailTestBody, response: { 200: EmailTestResponse } },
    },
    audited<FastifyRequest, EmailTestResult & { to: string }>(
      {
        eventType: 'EMAIL_DELIVERY_TEST',
        subject: (request) => request.user?.email ?? 'super_admin',
        message: (_request, result) =>
          `Email-delivery diagnostic sent to ${result.to} · resend id ${result.data.id}`,
        // The audit chain is sealed and access-controlled (`audit:read`), so the
        // destination is recorded here in full — unlike the application log, which
        // stays free of recipient addresses by design.
        details: (_request, result) => ({ to: result.to, resendId: result.data.id }),
      },
      async (request) => {
        const body = EmailTestBody.parse(request.body);
        const user = request.user;
        if (user === undefined) throw HttpError.unauthorized();

        const requestId = request.id;
        const subject =
          body.subject ?? `VUNVAULT email-delivery diagnostic (request ${requestId})`;
        const store = app.redisMode?.store ?? 'memory';

        try {
          const sent =
            options.send !== undefined
              ? await options.send(body.to, subject, requestId)
              : await app.email.send(
                  {
                    to: body.to,
                    subject,
                    html: `<p>This is a VUNVAULT email-delivery diagnostic.</p><p>It was sent by <strong>${user.email}</strong> and proves the Resend path is live end to end.</p><p>Request id: <code>${requestId}</code></p>`,
                    text: `This is a VUNVAULT email-delivery diagnostic.\n\nSent by ${user.email}.\nRequest id: ${requestId}`,
                  },
                  { requestId, purpose: 'diagnostics' },
                );

          request.log.info(
            { resendId: sent.id, store, requestId },
            'email-delivery diagnostic succeeded',
          );
          return { data: { id: sent.id, status: 200, store }, to: body.to };
        } catch (error) {
          // Loud, and honest: a failed diagnostic must never look like a success.
          // The caller sees a 502 with a generic code; the Resend detail is in the
          // log line the provider already wrote.
          request.log.error(
            { err: error, store, requestId },
            'email-delivery diagnostic FAILED — see the resend log line above for the reason',
          );
          throw new HttpError(
            502,
            'email_delivery_failed',
            'The test email was not accepted by the provider. See the API log for the Resend response.',
          );
        }
      },
    ),
  );
};

export default fp(diagnosticsRoutes, { name: 'diagnostics-routes' });

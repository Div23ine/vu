import { http, HttpResponse } from 'msw';
import { UpdateProfileBody } from '@vunvault/contracts';
import { clientProfile } from '@vunvault/contracts/fixtures/profile';

/**
 * Client-profile mock handlers .
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode; the fixture client (Jane Wanjiru, Acme Fintech Ltd) is the single
 * identity. The PATCH echoes the submitted fields back inside the fixture
 * profile so the UI's optimistic refresh shows the edit.
 *
 * NOTE: an earlier iteration parked a `GET /api/v1/profile` handler in `billing.ts` (the
 * invoice-table caption needed it before this task existed); an earlier iteration is the
 * owner — the handler moved here and billing.ts no longer registers it.
 *
 * API contract mirrored here (implemented for real in `apps/api`, an earlier iteration):
 * GET  /api/v1/profile → 200 { data: ClientProfile } | 403 no_org
 * PATCH /api/v1/profile body UpdateProfileBody → 200 { data: ClientProfile } | 400 validation_failed
 */

export const profileHandlers = [
  http.get('*/api/v1/profile', () => HttpResponse.json({ data: clientProfile })),

  http.patch('*/api/v1/profile', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = UpdateProfileBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const update = parsed.data;
    return HttpResponse.json({
      data: {
        ...clientProfile,
        fullName: update.fullName,
        jobTitle: update.jobTitle ?? null,
        phone: update.phone ?? null,
        company: {
          ...clientProfile.company,
          name: update.company.name,
          primaryDomain: update.company.primaryDomain ?? null,
          industry: update.company.industry ?? null,
        },
        updatedAt: new Date().toISOString(),
      },
    });
  }),
];

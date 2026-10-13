import { http, HttpResponse } from 'msw';
import { CreateScanBody, ScanFinding } from '@vunvault/contracts';
import { scanJobs } from '@vunvault/contracts/fixtures/scans';

/**
 * Portal scans mock handlers (Task 69).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. The RELEASE LOCK is mirrored exactly: the list and the detail serve
 * only the fixture jobs whose `reviewGateState` is `approved_released` —
 * anything else is a 404, the same answer the real API gives for "not yours,
 * not released, or gone".
 *
 * Findings have no contract fixture (Task 19's fixture set predates the
 * client report view), so the mock synthesises a deterministic
 * critical/high/medium/low set per released job — shape-checked against the
 * `ScanFinding` schema so mock and contract cannot drift. One evidence blob
 * deliberately contains a stored-XSS payload (`<img onerror=…>`) as TEXT: the
 * detail page must render it inert (Task 69's test asserts exactly that).
 * The wire objects also carry `evidenceRedacted` — a superset of the current
 * contract view (see the TODO in `findings-list.tsx`).
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 35):
 *   GET  /api/v1/scans?page=&pageSize=      → 200 { data: ScanJob[]; total }
 *   GET  /api/v1/scans/:id                  → 200 { data: ScanJob } | 404 not_found
 *   GET  /api/v1/scans/:id/findings         → 200 { data: ScanFinding[] }
 *   POST /api/v1/scans/authorisation-url    → 200 { data: { uploadUrl; objectKey; expiresAt } }
 *   POST /api/v1/scans                      → 201 { data: ScanJob } | 422 authorisation_missing | 422 target_not_allowed
 */

const RELEASED = scanJobs.filter((job) => job.reviewGateState === 'approved_released');

/** The private/internal ranges the real API rejects for self-service scans. */
const PRIVATE_TARGET =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?)/i;

interface MockFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cvss: number | null;
  cwe: string | null;
  status: 'open';
  remediationGuidance: string | null;
  evidenceRedacted: string;
}

function findingsFor(jobId: string): MockFinding[] {
  const rows: Array<Omit<MockFinding, 'id'>> = [
    {
      severity: 'critical',
      title: 'SQL injection in the reporting export',
      description:
        'The export endpoint concatenates the filter parameter into a SQL statement, allowing an authenticated user to read arbitrary tables.',
      cvss: 9.8,
      cwe: 'CWE-89',
      status: 'open',
      remediationGuidance:
        'Move the export to parameterised queries and deny the reporting role direct DDL access.',
      evidenceRedacted:
        'GET /export?filter=1%27%20UNION%20SELECT%20NULL-- HTTP/1.1\nAuthorization: Bearer [REDACTED]\n\nHTTP/1.1 200 OK\nX-Rows: 41213',
    },
    {
      severity: 'high',
      title: 'Stored XSS renders attacker markup in the evidence view',
      description:
        'A scanner note accepted raw HTML and replayed it to other users; the fixed client renders the string as text.',
      cvss: 8.1,
      cwe: 'CWE-79',
      status: 'open',
      remediationGuidance:
        'Encode all user-derived strings at render time and strip markup on ingest.',
      // The inertness probe: this exact string must appear as TEXT on the page.
      evidenceRedacted: '<img src=x onerror=alert(document.domain)>',
    },
    {
      severity: 'medium',
      title: 'Session cookie missing the __Host- prefix',
      description:
        'The session cookie is scoped to the apex domain instead of the exact host, weakening subdomain isolation.',
      cvss: 5.4,
      cwe: 'CWE-1188',
      status: 'open',
      remediationGuidance: 'Reissue the session cookie with __Host-, Secure, SameSite=Lax.',
      evidenceRedacted: 'Set-Cookie: vv_session=[REDACTED]; Path=/; Secure; HttpOnly',
    },
    {
      severity: 'low',
      title: 'Verbose server header on static assets',
      description: 'The CDN echoes the origin software version on 404 responses.',
      cvss: 2.6,
      cwe: 'CWE-200',
      status: 'open',
      remediationGuidance: 'Suppress the Server header at the edge.',
      evidenceRedacted: 'HTTP/2 404\nserver: nginx/1.27.1',
    },
  ];
  return rows.map((row, index) => ({
    ...row,
    // Valid UUID v4 shape, deterministic per job and position.
    id: `c5000000-0000-4000-8000-${jobId.slice(-6)}0000${index}0`.slice(0, 36),
  }));
}

// Shape-check once at module load so a contract change fails the mocks loudly.
for (const job of RELEASED) {
  for (const finding of findingsFor(job.id)) {
    if (!ScanFinding.safeParse(finding).success) {
      throw new Error(`The mock findings for ${job.jobCode} drifted from ScanFinding.`);
    }
  }
}

export const scansHandlers = [
  http.get('*/api/v1/scans', ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? '10')));
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      data: RELEASED.slice(start, start + pageSize),
      total: RELEASED.length,
    });
  }),

  http.post('*/api/v1/scans/authorisation-url', () =>
    HttpResponse.json({
      data: {
        uploadUrl: 'https://r2.vunvault.test/signed/authorisations/mock-authorisation.pdf',
        objectKey: 'authorisations/mock-authorisation.pdf',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
    }),
  ),

  // The presigned PUT target (the browser uploads the PDF straight to storage).
  http.put('https://r2.vunvault.test/signed/*', () => new HttpResponse(null, { status: 200 })),

  http.post('*/api/v1/scans', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = CreateScanBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    if (PRIVATE_TARGET.test(parsed.data.targetHost)) {
      return HttpResponse.json({ error: 'target_not_allowed' }, { status: 422 });
    }
    if (parsed.data.authorisationDocKey === 'missing') {
      return HttpResponse.json({ error: 'authorisation_missing' }, { status: 422 });
    }
    const first = RELEASED[0] ?? scanJobs[0];
    if (first === undefined) throw new Error('The scans fixture is empty.');
    return HttpResponse.json(
      {
        data: {
          ...first,
          id: 'c5000000-0000-4000-8000-000000004999',
          jobCode: 'JOB-4999',
          targetHost: parsed.data.targetHost,
          scanType: parsed.data.scanType,
          priority: parsed.data.priority,
          environment: parsed.data.environment ?? null,
          scopeNotes: parsed.data.scopeNotes ?? null,
          status: 'queued',
          progress: 0,
          etaSeconds: null,
          completedAt: null,
          reviewGateState: 'not_eligible',
          paymentStatus: 'pending',
          requestedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  }),

  http.get('*/api/v1/scans/:id/findings', ({ params }) => {
    const job = RELEASED.find((candidate) => candidate.id === String(params.id));
    if (job === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ data: findingsFor(job.id) });
  }),

  http.get('*/api/v1/scans/:id', ({ params }) => {
    const job = RELEASED.find((candidate) => candidate.id === String(params.id));
    if (job === undefined) {
      // The release lock: unreleased or unknown — the same 404.
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ data: job });
  }),
];

import { http, HttpResponse } from 'msw';
import type {
  AdvisoryDraftBody,
  AdvisoryPatchStatus,
  BroadcastRecord,
  DraftListItem,
  NvdImportResult,
} from '@vunvault/contracts';
// `Advisory` and `EmergencyBroadcastBody` are imported as values: the mock
// schema-checks every synthesised record with `Advisory.parse` and gates a
// dispatch with the contract's own broadcast rule, so neither can drift.
import { Advisory, CVE_ID_PATTERN, EmergencyBroadcastBody } from '@vunvault/contracts';
import {
  advisories,
  advisorySummary,
  broadcastEstimate,
  drafts,
} from '@vunvault/contracts/fixtures/intel';

/**
 * Admin Zero-Day desk mock handlers (Task 81).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode.
 * The Task 20d fixtures ARE the published table (`advisories`), the tiles
 * (`advisorySummary`) and the drafts panel (`drafts`).
 *
 * `drafts` is the LIGHT `DraftListItem` shape — enough for the panel, not
 * enough to refill the editor — and the contract has no `GET /:id`, so this
 * file also synthesises the three full draft `Advisory` records behind those
 * ids (schema-checked with `Advisory.parse`, so mock and contract cannot
 * drift). The `note` values stay consistent with the synthesised bodies: the
 * `Needs scope entries` draft really has an empty scope list.
 *
 * Writes mutate a module-level copy; tests reset it with
 * `resetAdminAdvisories()`.
 *
 * Registration order matters: MSW matches in order, so the literal
 * `/summary`, `/drafts` and `/nvd` paths are registered BEFORE any `/:id`
 * route that would otherwise swallow them.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 38):
 *   GET   /api/v1/admin/advisories/summary        → 200 { data: AdvisorySummary }
 *   GET   /api/v1/admin/advisories/drafts         → 200 { data: DraftListItem[] }
 *   GET   /api/v1/admin/advisories/nvd?cveId=     → 200 { data: NvdImportResult } | 400 | 404 | 502
 *   GET   /api/v1/admin/advisories?status=        → 200 { data: Advisory[]; total }
 *   POST  /api/v1/admin/advisories                → 201 { data: Advisory } | 409 cve_exists
 *   PUT   /api/v1/admin/advisories/:id            → 200 { data: Advisory } | 404 | 409 not_editable
 *   PATCH /api/v1/admin/advisories/:id/patch-status → 200 { data: Advisory } | 404
 *   POST  /api/v1/admin/advisories/:id/retract    → 200 { data: Advisory } | 404 | 422
 */

/** The intelligence desk's own authors, keyed by the fixture labels. */
const AUTHORS = {
  'e.reed': { id: 'c0000000-0000-4000-8000-000000000001', label: 'e.reed' },
  'f.hassan': { id: 'c0000000-0000-4000-8000-000000000004', label: 'f.hassan' },
  'd.mwangi': { id: 'c0000000-0000-4000-8000-000000000003', label: 'd.mwangi' },
} as const;

function draftAdvisory(
  index: number,
  body: Omit<Advisory, 'id' | 'status' | 'reach' | 'publishedAt' | 'lastBroadcastAt'>,
): Advisory {
  return Advisory.parse({
    ...body,
    id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    status: 'draft',
    publishedAt: null,
    lastBroadcastAt: null,
    reach: null,
  });
}

/**
 * The three full draft records behind the `drafts` fixture ids
 * (`advisoryId(7)` … `advisoryId(9)` in `fixtures/intel.ts`).
 */
const draftRecords: Advisory[] = [
  draftAdvisory(7, {
    cveId: 'CVE-2026-40118',
    vendor: 'Kubernetes',
    cvss: 9.1,
    disclosureDate: '2026-09-24',
    severity: 'critical',
    weaponized: false,
    publicPoc: true,
    preAuth: true,
    patchAvailable: false,
    title: 'Kubernetes ingress-nginx — admission webhook bypass',
    summary:
      'A crafted admission review payload is accepted without webhook verification, letting an attacker with pod-create rights install a validating webhook of their own.',
    remediation: null,
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-40118'],
    scope: [{ label: 'ingress-nginx 1.9 – 1.11', category: 'cloud_containers' }],
    patchStatus: 'unpatched',
    author: { ...AUTHORS['e.reed'] },
    lastSavedAt: '2026-09-24T13:58:00Z',
  }),
  draftAdvisory(8, {
    cveId: 'CVE-2026-39980',
    vendor: 'PostgreSQL',
    cvss: 7.8,
    disclosureDate: '2026-09-23',
    severity: 'high',
    weaponized: false,
    publicPoc: false,
    preAuth: false,
    patchAvailable: true,
    title: 'PostgreSQL — privilege escalation via extension loading',
    summary:
      'A superuser-only extension control file is resolved from a writable directory, allowing a low-privileged role to load arbitrary code into the backend.',
    remediation:
      'Restrict `dynamic_library_path` to the packaged library directory and apply the vendor minor release at the next maintenance window.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-39980'],
    scope: [{ label: 'PostgreSQL 15 – 17', category: 'web_api' }],
    patchStatus: 'patch_in_progress',
    author: { ...AUTHORS['f.hassan'] },
    lastSavedAt: '2026-09-24T13:41:00Z',
  }),
  draftAdvisory(9, {
    cveId: 'CVE-2026-38771',
    vendor: 'Redis',
    cvss: 5.4,
    disclosureDate: '2026-09-22',
    severity: 'medium',
    weaponized: false,
    publicPoc: false,
    preAuth: false,
    patchAvailable: false,
    title: 'Redis — ACL bypass in sentinel failover path',
    summary:
      'Sentinel reconnects with the default user after a failover, bypassing the ACL rules applied to the previous primary.',
    remediation: null,
    references: [],
    // `Needs scope entries` — the note the API computes from this empty list.
    scope: [],
    patchStatus: 'unpatched',
    author: { ...AUTHORS['d.mwangi'] },
    lastSavedAt: '2026-09-24T13:20:00Z',
  }),
];

let store: Advisory[] = [...advisories, ...draftRecords];

/** Restore the fixture store (tests call this in `beforeEach`). */
export function resetAdminAdvisories(): void {
  store = [...advisories, ...draftRecords];
  broadcasts = [];
  broadcastSeq = 0;
  created = 0;
}

function byStatus(status: string | null): Advisory[] {
  if (status === null || status === '') return store;
  return store.filter((advisory) => advisory.status === status);
}

/** The light panel shape, derived from the full record so the two agree. */
function toDraftItem(advisory: Advisory): DraftListItem {
  const fixture = drafts.find((draft) => draft.id === advisory.id);
  return {
    id: advisory.id,
    cveId: advisory.cveId,
    title: advisory.title,
    authorLabel: advisory.author.label,
    lastSavedAt: advisory.lastSavedAt ?? new Date().toISOString(),
    // The API computes the note from completeness; fixture drafts keep theirs.
    note: fixture?.note ?? (advisory.scope.length === 0 ? 'Needs scope entries' : null),
  };
}

/**
 * NVD catalogue. The six published fixtures are importable (so re-importing a
 * known CVE reproduces the desk's own data), plus two entries that are NOT in
 * the store — importing one of those exercises the create path end to end.
 */
const NVD_CATALOGUE: Record<string, NvdImportResult> = {
  'CVE-2026-44120': {
    cveId: 'CVE-2026-44120',
    vendor: 'Apache Software Foundation',
    cvss: 9.8,
    severity: 'critical',
    disclosureDate: '2026-09-24',
    title: 'Apache Tomcat — request smuggling in the AJP connector',
    summary:
      'Malformed AJP request prefixes are not rejected, allowing an unauthenticated attacker to poison the response cache of a downstream proxy.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-44120'],
  },
  'CVE-2026-43907': {
    cveId: 'CVE-2026-43907',
    vendor: 'HashiCorp',
    cvss: 6.5,
    severity: 'medium',
    disclosureDate: '2026-09-23',
    title: 'Vault — token leakage through the audit log formatter',
    summary:
      'A debug-level audit formatter writes the client token alongside the request path, exposing it to anyone with log read access.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-43907'],
  },
};

function nvdFromStore(cveId: string): NvdImportResult | undefined {
  const known = store.find((advisory) => advisory.cveId === cveId);
  if (known === undefined) return undefined;
  return {
    cveId: known.cveId,
    vendor: known.vendor,
    cvss: known.cvss,
    severity: known.severity,
    disclosureDate: known.disclosureDate,
    title: known.title,
    summary: known.summary,
    references: known.references,
  };
}

let created = 0;

function newAdvisory(body: AdvisoryDraftBody, now: string): Advisory {
  created += 1;
  return Advisory.parse({
    id: `20000000-0000-4000-8000-${String(created).padStart(12, '0')}`,
    cveId: body.cveId,
    vendor: body.vendor ?? null,
    cvss: body.cvss ?? null,
    disclosureDate: body.disclosureDate ?? null,
    severity: body.severity ?? null,
    weaponized: body.weaponized,
    publicPoc: body.publicPoc,
    preAuth: body.preAuth,
    patchAvailable: body.patchAvailable,
    title: body.title ?? null,
    summary: body.summary ?? null,
    remediation: body.remediation ?? null,
    references: body.references,
    scope: body.scope,
    status: 'draft',
    patchStatus: 'unpatched',
    author: { ...AUTHORS['e.reed'] },
    lastSavedAt: now,
    publishedAt: null,
    lastBroadcastAt: null,
    reach: null,
  });
}

function replace(id: string, next: Advisory): void {
  store = store.map((advisory) => (advisory.id === id ? next : advisory));
}

function notFound(): ReturnType<typeof HttpResponse.json> {
  return HttpResponse.json({ error: 'not_found' }, { status: 404 });
}

/** Dispatched broadcasts, newest last; the progress endpoint reverses them. */
let broadcasts: BroadcastRecord[] = [];
let broadcastSeq = 0;

/**
 * The dispatch both broadcast doors share.
 *
 * The gate is the contract's own `EmergencyBroadcastBody` — five
 * acknowledgements plus the typed phrase — so the mock rejects exactly what the
 * API would (400 `validation_failed`). An advisory missing its title, severity
 * or scope answers 422 `advisory_incomplete` with the missing fields as
 * `details`, which is what the dialog quotes back. A second dispatch inside the
 * same minute is the 409 the spec names.
 */
function dispatch(
  id: string,
  kind: BroadcastRecord['kind'],
  body: unknown,
): ReturnType<typeof HttpResponse.json> {
  const advisory = store.find((candidate) => candidate.id === id);
  if (advisory === undefined) return notFound();

  const gate = EmergencyBroadcastBody.safeParse(body);
  if (!gate.success) {
    return HttpResponse.json(
      { error: 'validation_failed', details: gate.error.issues.map((issue) => issue.message) },
      { status: 400 },
    );
  }

  const missing = [
    advisory.title === null || advisory.title === '' ? 'title' : null,
    advisory.severity === null ? 'severity' : null,
    advisory.scope.length === 0 ? 'scope' : null,
  ].filter((field): field is string => field !== null);
  if (missing.length > 0) {
    return HttpResponse.json(
      { error: 'advisory_incomplete', details: missing },
      { status: 422 },
    );
  }

  const inFlight = broadcasts.find(
    (record) => record.advisoryId === id && record.status !== 'sent' && record.status !== 'failed',
  );
  if (inFlight !== undefined) {
    return HttpResponse.json({ error: 'broadcast_in_progress' }, { status: 409 });
  }

  broadcastSeq += 1;
  const now = new Date().toISOString();
  const record: BroadcastRecord = {
    id: `30000000-0000-4000-8000-${String(broadcastSeq).padStart(12, '0')}`,
    advisoryId: id,
    kind,
    // The strip counts up from zero so the poll is observable.
    status: 'sending',
    triggeredByLabel: AUTHORS['e.reed'].label,
    audienceDashboards: broadcastEstimate.dashboards,
    emailContacts: broadcastEstimate.emailContacts,
    smsContacts: broadcastEstimate.smsContacts,
    sentDashboards: 0,
    sentEmail: 0,
    sentSms: 0,
    failed: 0,
    createdAt: now,
    finishedAt: null,
  };
  broadcasts = [...broadcasts, record];

  // Dispatch publishes: the advisory leaves the draft list and gains a stamp.
  replace(id, {
    ...advisory,
    status: 'published',
    publishedAt: advisory.publishedAt ?? now,
    lastBroadcastAt: now,
    reach: record.audienceDashboards,
  });

  return HttpResponse.json({ data: record }, { status: 202 });
}

export const adminAdvisoriesHandlers = [
  // ——— Literal paths FIRST (MSW matches in registration order) ———
  http.get('*/api/v1/admin/advisories/summary', () =>
    HttpResponse.json({ data: advisorySummary }),
  ),

  http.get('*/api/v1/admin/advisories/drafts', () =>
    HttpResponse.json({
      data: byStatus('draft')
        .map(toDraftItem)
        .sort((a, b) => new Date(b.lastSavedAt).getTime() - new Date(a.lastSavedAt).getTime()),
    }),
  ),

  http.get('*/api/v1/admin/advisories/nvd', ({ request }) => {
    const cveId = new URL(request.url).searchParams.get('cveId') ?? '';
    if (!CVE_ID_PATTERN.test(cveId)) {
      return HttpResponse.json({ error: 'validation_failed' }, { status: 400 });
    }
    const result = NVD_CATALOGUE[cveId] ?? nvdFromStore(cveId);
    if (result === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ data: result });
  }),

  // ——— Collection ———
  http.get('*/api/v1/admin/advisories', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    const rows = byStatus(status);
    return HttpResponse.json({ data: rows, total: rows.length });
  }),

  http.post('*/api/v1/admin/advisories', async ({ request }) => {
    const body = (await request.json()) as AdvisoryDraftBody;
    if (store.some((advisory) => advisory.cveId === body.cveId)) {
      return HttpResponse.json({ error: 'cve_exists' }, { status: 409 });
    }
    const advisory = newAdvisory(body, new Date().toISOString());
    store = [advisory, ...store];
    return HttpResponse.json({ data: advisory }, { status: 201 });
  }),

  // ——— Item writes ———
  http.put('*/api/v1/admin/advisories/:id', async ({ params, request }) => {
    const id = String(params.id);
    const existing = store.find((advisory) => advisory.id === id);
    if (existing === undefined) return notFound();
    if (existing.status !== 'draft') {
      return HttpResponse.json({ error: 'not_editable' }, { status: 409 });
    }
    const body = (await request.json()) as AdvisoryDraftBody;
    const updated: Advisory = {
      ...existing,
      cveId: body.cveId,
      vendor: body.vendor ?? null,
      cvss: body.cvss ?? null,
      disclosureDate: body.disclosureDate ?? null,
      severity: body.severity ?? null,
      weaponized: body.weaponized,
      publicPoc: body.publicPoc,
      preAuth: body.preAuth,
      patchAvailable: body.patchAvailable,
      title: body.title ?? null,
      summary: body.summary ?? null,
      remediation: body.remediation ?? null,
      references: body.references,
      scope: body.scope,
      lastSavedAt: new Date().toISOString(),
    };
    replace(id, updated);
    return HttpResponse.json({ data: updated });
  }),

  http.patch('*/api/v1/admin/advisories/:id/patch-status', async ({ params, request }) => {
    const id = String(params.id);
    const existing = store.find((advisory) => advisory.id === id);
    if (existing === undefined) return notFound();
    const { patchStatus } = (await request.json()) as { patchStatus: AdvisoryPatchStatus };
    const updated = { ...existing, patchStatus };
    replace(id, updated);
    return HttpResponse.json({ data: updated });
  }),

  http.post('*/api/v1/admin/advisories/:id/retract', async ({ params, request }) => {
    const id = String(params.id);
    const existing = store.find((advisory) => advisory.id === id);
    if (existing === undefined) return notFound();
    const { note } = (await request.json()) as { note: string };
    if (note.trim().length < 10) {
      return HttpResponse.json(
        { error: 'validation_failed', details: [{ path: ['note'], message: 'Too short' }] },
        { status: 422 },
      );
    }
    const updated: Advisory = { ...existing, status: 'retracted' };
    replace(id, updated);
    return HttpResponse.json({ data: updated });
  }),

  // The audience a broadcast would reach (Task 81's reach panel; Task 82's
  // dialog reuses it). Per-advisory, so an unsaved draft cannot be estimated.
  http.post('*/api/v1/admin/advisories/:id/estimate', ({ params }) => {
    const id = String(params.id);
    if (!store.some((advisory) => advisory.id === id)) return notFound();
    return HttpResponse.json({ data: broadcastEstimate });
  }),

  // ——— Task 82: the irreversible dispatch ———
  http.post('*/api/v1/admin/advisories/:id/broadcast', async ({ params, request }) =>
    dispatch(String(params.id), 'initial', await request.json()),
  ),

  http.post('*/api/v1/admin/advisories/:id/rebroadcast', async ({ params, request }) =>
    dispatch(String(params.id), 'rebroadcast', await request.json()),
  ),

  http.get('*/api/v1/admin/advisories/:id/broadcasts', ({ params }) => {
    const id = String(params.id);
    if (!store.some((advisory) => advisory.id === id)) return notFound();
    const records = broadcasts
      .filter((record) => record.advisoryId === id)
      // Newest first — the progress strip reads `[0]`.
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // Each poll advances an in-flight record; the third reading settles it, so
    // the strip visibly counts up and then stops (the spec's 3 s poll).
    for (const record of records) {
      if (record.status !== 'sending') continue;
      record.sentDashboards = Math.min(
        record.audienceDashboards,
        record.sentDashboards + Math.ceil(record.audienceDashboards / 2),
      );
      record.sentEmail = Math.min(
        record.emailContacts,
        record.sentEmail + Math.ceil(record.emailContacts / 2),
      );
      record.sentSms = Math.min(
        record.smsContacts,
        record.sentSms + Math.ceil(record.smsContacts / 2),
      );
      if (record.sentDashboards >= record.audienceDashboards) {
        record.status = 'sent';
        record.finishedAt = new Date().toISOString();
      }
    }
    return HttpResponse.json({ data: records });
  }),
];

import { http, HttpResponse } from 'msw';
import { ClientAdvisory } from '@vunvault/contracts';

/**
 * Portal advisories mock handlers .
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. The an earlier iteration client feed is mirrored exactly: published,
 * environment-matched advisories only — a retracted advisory never appears
 * (the seed simply has none) — and acknowledge is idempotent per
 * organisation.
 *
 * The client feed has no contract fixture (an earlier iteration's fixture set covers the
 * admin `Advisory` shape), so the mock synthesises a deterministic four-item
 * `ClientAdvisory` seed — schema-checked with `ClientAdvisory.parse` so mock
 * and contract cannot drift — plus a module-level acknowledgement set the
 * tests reset through `resetAdvisoryAcks()`.
 *
 * The seed is ordered for the display rules: the CRITICAL entry is the
 * OLDEST (so "pinned first" visibly beats "newest first"), the HIGH entry is
 * the newest, the MEDIUM entry ships pre-acknowledged and the LOW entry has
 * a scope entry with a `null` category and the MEDIUM entry empty
 * references.
 *
 * API contract mirrored here (implemented for real in `apps/api`, an earlier iteration):
 * GET /api/v1/advisories → 200 { data: ClientAdvisory[]; total }
 * POST /api/v1/advisories/:id/acknowledge → 204
 */

export const advisorySeed: ClientAdvisory[] = [
  ClientAdvisory.parse({
    id: 'ad100000-0000-4000-8000-000000000001',
    cveId: 'CVE-2026-21596',
    title: 'Edge proxy session resumption bypass exposes origin traffic',
    severity: 'critical',
    scope: [
      { label: 'Edge TLS terminators', category: 'network_edge' },
      { label: 'Payments API', category: 'web_api' },
    ],
    summary:
      'A session resumption flaw in widely deployed edge proxies lets an unauthenticated network attacker resume a victim TLS session and read origin traffic destined for customer dashboards.',
    remediation:
      'Upgrade affected edge proxies to the vendor release published on 3 October 2026 and disable stateless session resumption until every node is patched.',
    references: [
      'https://nvd.nist.gov/vuln/detail/CVE-2026-21596',
      'https://status.vunvault.test/advisories/CVE-2026-21596',
    ],
    patchStatus: 'unpatched',
    publishedAt: '2026-10-01T09:00:00.000Z',
    source: 'VUNVAULT Intelligence',
    acknowledged: false,
  }),
  ClientAdvisory.parse({
    id: 'ad100000-0000-4000-8000-000000000002',
    cveId: 'CVE-2026-30812',
    title: 'Object storage signature validation flaw allows bucket enumeration',
    severity: 'high',
    scope: [{ label: 'Customer dashboard', category: 'web_api' }],
    summary:
      'Improper signature validation in the storage gateway permits an authenticated low-privilege user to enumerate private bucket names across tenants.',
    remediation:
      'Rotate gateway signing keys, apply the vendor patch and audit gateway logs for enumeration patterns since 28 September 2026.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-30812'],
    patchStatus: 'patch_in_progress',
    publishedAt: '2026-10-07T06:30:00.000Z',
    source: 'VUNVAULT Intelligence',
    acknowledged: false,
  }),
  ClientAdvisory.parse({
    id: 'ad100000-0000-4000-8000-000000000003',
    cveId: 'CVE-2026-11477',
    title: 'SSO assertion replay window wider than advertised',
    severity: 'medium',
    scope: [{ label: 'Corporate SSO', category: 'identity_sso' }],
    summary:
      'The identity provider accepts replayed SAML assertions for up to ten minutes, exceeding the documented two-minute window.',
    remediation:
      'Enable assertion caching on the provider and reduce the replay window to 120 seconds in the next maintenance release.',
    references: [],
    patchStatus: 'patched',
    publishedAt: '2026-10-05T12:00:00.000Z',
    source: 'VUNVAULT Intelligence',
    acknowledged: true,
  }),
  ClientAdvisory.parse({
    id: 'ad100000-0000-4000-8000-000000000004',
    cveId: 'CVE-2026-09953',
    title: 'Verbose error payloads leak internal hostnames',
    severity: 'low',
    scope: [{ label: 'Field sensors', category: null }],
    summary:
      'Debug error payloads from field sensor endpoints include internal hostnames, aiding reconnaissance but exposing no customer data.',
    remediation:
      'Suppress debug payloads in production and strip hostnames at the gateway until the sensor firmware update ships.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-09953'],
    patchStatus: 'patched',
    publishedAt: '2026-10-06T18:45:00.000Z',
    source: 'VUNVAULT Intelligence',
    acknowledged: false,
  }),
];

const initiallyAcknowledged = advisorySeed
  .filter((item) => item.acknowledged)
  .map((item) => item.id);
const acknowledgedIds = new Set<string>(initiallyAcknowledged);

/** Restore the seed's acknowledgement state (tests call this in `beforeEach`). */
export function resetAdvisoryAcks(): void {
  acknowledgedIds.clear();
  for (const id of initiallyAcknowledged) acknowledgedIds.add(id);
}

/**
 * Mark one seed advisory acknowledged. The standing handler uses it, and
 * delayed test overrides call it too so a post-mutation refetch sees the
 * same state the real API would have.
 */
export function acknowledgeSeedAdvisory(id: string): void {
  acknowledgedIds.add(id);
}

export const advisoriesHandlers = [
  http.get('*/api/v1/advisories', () => {
    const data = advisorySeed.map((item) => ({
      ...item,
      acknowledged: acknowledgedIds.has(item.id),
    }));
    return HttpResponse.json({ data, total: data.length });
  }),

  // Idempotent: acknowledging twice is still one acknowledgement, 204 both times.
  http.post('*/api/v1/advisories/:id/acknowledge', ({ params }) => {
    acknowledgeSeedAdvisory(String(params.id));
    return new HttpResponse(null, { status: 204 });
  }),
];

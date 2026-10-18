import { describe, expect, it } from 'vitest';
import type { AdvisoryScopeEntry } from '@vunvault/contracts';
import {
  countsTowardsReach,
  estimateAudience,
  labelNamesProduct,
  matchClients,
  matchesAsset,
  REACH_WINDOW_MS,
  type ClientAsset,
} from './advisory-matching.js';

/**
 * Scope → estate matching.
 *
 * The catalogue's example is the first test: a scope entry written the way an
 * analyst writes it must find the client running the software.
 */

const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const ORG_B = 'd1000000-0000-4000-8000-0000000000b1';

function asset(overrides: Partial<ClientAsset> = {}): ClientAsset {
  return {
    orgId: ORG_A,
    category: 'web_api',
    product: 'Struts 2',
    version: '2.5.30',
    host: 'api.acmefintech.co.ke',
    ...overrides,
  };
}

const STRUTS_SCOPE: AdvisoryScopeEntry[] = [
  { label: 'Web & API · Struts 2.0.0 – 2.5.32', category: 'web_api' },
];

describe('matchClients', () => {
  it('matches the documented scope entry against the documented asset', () => {
    const result = matchClients(STRUTS_SCOPE, [asset()]);
    expect(result.orgIds).toEqual([ORG_A]);
    expect(result.matched).toEqual([
      { orgId: ORG_A, product: 'Struts 2', scopeLabel: STRUTS_SCOPE[0]?.label },
    ]);
  });

  it('counts an organisation once, however many assets match', () => {
    const result = matchClients(STRUTS_SCOPE, [
      asset(),
      asset({ host: 'staging.acmefintech.co.ke', version: '2.3.1' }),
      asset({ orgId: ORG_B, product: 'Struts 2.5' }),
    ]);
    expect(result.orgIds).toEqual([ORG_A, ORG_B]);
    expect(result.matched).toHaveLength(3);
  });

  it('respects the category when the scope entry has one', () => {
    expect(matchClients(STRUTS_SCOPE, [asset({ category: 'database' })]).orgIds).toEqual([]);
    // An entry with no category matches on the label alone.
    const anyCategory: AdvisoryScopeEntry[] = [{ label: 'Struts 2.0.0 – 2.5.32', category: null }];
    expect(matchClients(anyCategory, [asset({ category: 'database' })]).orgIds).toEqual([ORG_A]);
  });

  it('matches nothing when nothing is in scope', () => {
    const result = matchClients(
      [{ label: 'SAP NetWeaver 7.5', category: 'web_api' }],
      [asset(), asset({ orgId: ORG_B, product: 'PostgreSQL', category: 'database' })],
    );
    expect(result.orgIds).toEqual([]);
    expect(result.matched).toEqual([]);
  });

  it('handles an empty scope and an empty estate', () => {
    expect(matchClients([], [asset()]).orgIds).toEqual([]);
    expect(matchClients(STRUTS_SCOPE, []).orgIds).toEqual([]);
  });
});

describe('labelNamesProduct', () => {
  it('is case- and punctuation-insensitive', () => {
    expect(labelNamesProduct('Web & API · Struts 2.0.0 – 2.5.32', 'Struts 2')).toBe(true);
    expect(labelNamesProduct('STRUTS 2.5', 'struts 2')).toBe(true);
    expect(labelNamesProduct('Apache Struts', 'struts')).toBe(true);
  });

  it('matches on the product’s first word when the label is broader', () => {
    expect(labelNamesProduct('Apache HTTP Server 2.4', 'httpd')).toBe(false);
    expect(labelNamesProduct('httpd 2.4 mod_rewrite', 'Apache httpd')).toBe(true);
  });

  it('refuses an empty label or product, and a two-letter guess', () => {
    expect(labelNamesProduct('', 'Struts 2')).toBe(false);
    expect(labelNamesProduct('Struts', '')).toBe(false);
    // A two-letter token would match half the estate.
    expect(labelNamesProduct('Something about SAP systems', 'AP')).toBe(false);
  });

  it('matches an asset on its own', () => {
    expect(matchesAsset(STRUTS_SCOPE[0] as AdvisoryScopeEntry, asset())).toBe(true);
    expect(matchesAsset(STRUTS_SCOPE[0] as AdvisoryScopeEntry, asset({ product: 'nginx' }))).toBe(
      false,
    );
  });
});

describe('estimateAudience', () => {
  it('counts dashboards from the matched organisations', () => {
    expect(
      estimateAudience({
        matchedOrgIds: [ORG_A, ORG_B],
        emailContacts: 7,
        smsContacts: 3,
      }),
    ).toEqual({ dashboards: 2, emailContacts: 7, smsContacts: 3, incidentCommanders: 1 });
  });

  it('pages exactly one incident commander', () => {
    expect(
      estimateAudience({ matchedOrgIds: [], emailContacts: 0, smsContacts: 0 }).incidentCommanders,
    ).toBe(1);
    expect(
      estimateAudience({
        matchedOrgIds: [ORG_A],
        emailContacts: 1,
        smsContacts: 1,
        incidentCommanders: 0,
      }).incidentCommanders,
    ).toBe(0);
  });
});

describe('the reach window', () => {
  const firstBroadcast = '2026-10-01T09:00:00.000Z';

  it('is twenty-four hours from the first broadcast', () => {
    expect(REACH_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
    expect(countsTowardsReach(firstBroadcast, '2026-10-01T09:00:00.000Z')).toBe(true);
    expect(countsTowardsReach(firstBroadcast, '2026-10-02T08:59:59.999Z')).toBe(true);
    expect(countsTowardsReach(firstBroadcast, '2026-10-02T09:00:00.001Z')).toBe(false);
  });

  it('does not count an acknowledgement that predates the broadcast', () => {
    expect(countsTowardsReach(firstBroadcast, '2026-09-30T09:00:00.000Z')).toBe(false);
  });

  it('has no reach when there was no broadcast', () => {
    expect(countsTowardsReach(null, '2026-10-01T09:00:00.000Z')).toBe(false);
  });
});

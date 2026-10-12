import type { AdvisoryScopeEntry, BroadcastEstimate } from '@vunvault/contracts';

/**
 * Who does this advisory affect?
 *
 * An advisory's `scope` is written by an analyst in words ("Web & API · Struts
 * 2.0.0 – 2.5.32"); the client estate is rows in `client_assets` with a category
 * and a product string. Matching the two is deliberately generous: a false
 * negative means a client is not told about an exploited vulnerability in software
 * they run, and that is far worse than an extra dashboard lighting up.
 *
 * The rule is: the asset's category equals the scope entry's category (when the
 * entry has one), AND at least one significant word of the asset's product appears
 * as a whole word in the scope label — compared case- and punctuation-insensitively,
 * with the version range in the label ignored. Version precision is the analyst's
 * job in the summary; the audience estimate is about reach, not about who is
 * definitely vulnerable.
 *
 * Pure: no database, no clock. `estimateAudience` turns the matched organisations
 * and the contact counts the repository supplies into the shape the editor shows.
 */

export interface ClientAsset {
  orgId: string;
  category: string | null;
  product: string;
  version: string | null;
  host: string | null;
}

export interface MatchResult {
  /** Distinct organisations, in the order their first matching asset appeared. */
  orgIds: string[];
  /** Which assets matched, for an operator who wants to see why. */
  matched: Array<{ orgId: string; product: string; scopeLabel: string }>;
}

/** Collapse case, punctuation and repeated spaces so labels compare sanely. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * True when an asset's product is named by a scope label.
 *
 * Either direction counts: the label may be narrower than the product
 * (`Struts 2.0.0 – 2.5.32` vs `Struts 2`) or broader (`Apache HTTP Server` vs
 * `httpd`), so both the whole normalised product and its first token are tried.
 */
export function labelNamesProduct(scopeLabel: string, product: string): boolean {
  const labelTokens = new Set(
    normalise(scopeLabel)
      .split(' ')
      .filter((token) => token !== ''),
  );
  // Tokens shorter than three characters are dropped: `ap` is a substring of
  // `sap`, and matching on that would page a client about software they do not run.
  const productTokens = normalise(product)
    .split(' ')
    .filter((token) => token.length >= 3);
  if (labelTokens.size === 0 || productTokens.length === 0) return false;
  return productTokens.some((token) => labelTokens.has(token));
}

/** One scope entry against one asset. */
export function matchesAsset(entry: AdvisoryScopeEntry, asset: ClientAsset): boolean {
  if (entry.category !== null && asset.category !== null && entry.category !== asset.category) {
    return false;
  }
  return labelNamesProduct(entry.label, asset.product);
}

/** Every organisation whose estate touches any scope entry. */
export function matchClients(
  scope: readonly AdvisoryScopeEntry[],
  assets: readonly ClientAsset[],
): MatchResult {
  const orgIds: string[] = [];
  const seen = new Set<string>();
  const matched: MatchResult['matched'] = [];

  for (const asset of assets) {
    for (const entry of scope) {
      if (!matchesAsset(entry, asset)) continue;
      matched.push({ orgId: asset.orgId, product: asset.product, scopeLabel: entry.label });
      if (!seen.has(asset.orgId)) {
        seen.add(asset.orgId);
        orgIds.push(asset.orgId);
      }
      // One matching scope entry is enough for this asset.
      break;
    }
  }

  return { orgIds, matched };
}

/**
 * The audience the editor shows before anybody commits to a broadcast.
 *
 * `incidentCommanders` is one by design: a SEV-1 escalation pages the single
 * on-duty commander (`INCIDENT_COMMANDER_ID`), not a distribution list. It is a
 * parameter rather than a constant so a test can prove the value is not invented
 * from the matched estate.
 */
export function estimateAudience(input: {
  matchedOrgIds: readonly string[];
  emailContacts: number;
  smsContacts: number;
  incidentCommanders?: number;
}): BroadcastEstimate {
  return {
    dashboards: input.matchedOrgIds.length,
    emailContacts: input.emailContacts,
    smsContacts: input.smsContacts,
    incidentCommanders: input.incidentCommanders ?? 1,
  };
}

/** How long after the first broadcast an acknowledgement still counts as reach. */
export const REACH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** True when an acknowledgement landed inside the reach window. */
export function countsTowardsReach(
  firstBroadcastAt: string | Date | null,
  acknowledgedAt: string | Date,
): boolean {
  if (firstBroadcastAt === null) return false;
  const start = new Date(firstBroadcastAt).getTime();
  const at = new Date(acknowledgedAt).getTime();
  return at >= start && at - start <= REACH_WINDOW_MS;
}

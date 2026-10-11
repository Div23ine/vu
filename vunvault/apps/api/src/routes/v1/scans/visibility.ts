/**
 * The client-portal RELEASE LOCK, defined once.
 *
 * A scan report is the product of an offensive test against a client's own
 * infrastructure. Until a member of staff has passed it through the Mandatory
 * Admin Review Gate and released it, the client must not see it — not in a list,
 * not by id, and not through a findings or report query.
 *
 * So every client-facing scan query in the API is built with `clientVisibleWhere`
 * and nothing else. The rule is:
 *
 *   `org_id = <caller's org>` AND `review_gate_state = 'approved_released'`
 *
 * A job in any other gate state (`not_eligible`, `in_review`, `held_blocked`,
 * `blocked_payment`) is invisible: it is omitted from lists and answered with
 * `404 not_found` on a direct fetch — never `403`, never a hint that it exists.
 * A 403 would confirm that the id is real and that something is being withheld.
 *
 * `scans.test.ts` fails if a client-facing query builds its own copy of this
 * predicate instead of calling this function.
 */

import type { ReviewGateState } from '@vunvault/db/enum-values';

/** The only gate state a client may ever see. */
export const CLIENT_VISIBLE_GATE: ReviewGateState = 'approved_released';

/** Every gate state that is withheld from the client portal. */
export const HIDDEN_GATE_STATES: readonly ReviewGateState[] = [
  'not_eligible',
  'in_review',
  'held_blocked',
  'blocked_payment',
];

/** The table alias every scan query uses for `scan_jobs`. */
export const SCAN_JOBS_ALIAS = 'sj';

export interface ClientVisibility {
  /** SQL predicate. The organisation id is bound, never interpolated. */
  fragment: string;
  /** Bind values for `fragment`, in order. */
  values: unknown[];
}

/**
 * The release-lock predicate for one organisation.
 *
 * `orgPlaceholder` is the positional parameter the caller has already reserved for
 * the org id (`$1` by convention: pass the org id as the first bind value).
 */
export function clientVisibleWhere(orgId: string, orgPlaceholder = '$1'): ClientVisibility {
  return {
    fragment: `${SCAN_JOBS_ALIAS}.org_id = ${orgPlaceholder}::uuid and ${SCAN_JOBS_ALIAS}.review_gate_state = '${CLIENT_VISIBLE_GATE}'`,
    values: [orgId],
  };
}

/**
 * The same rule in memory, for services that already hold a row. A route must not
 * use this to repair a query that forgot the predicate — the query is the control.
 */
export function isClientVisible(
  row: { orgId: string; reviewGateState: string },
  orgId: string,
): boolean {
  return row.orgId === orgId && row.reviewGateState === CLIENT_VISIBLE_GATE;
}

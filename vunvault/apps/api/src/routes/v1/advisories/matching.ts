/**
 * Re-export (Task 89).
 *
 * The audience-matching rules moved to `@vunvault/lib/advisory-matching` so the
 * broadcast worker can apply the SAME matching the editor's estimate did — two
 * copies of "who is affected" is how a client gets missed. This file stays so
 * every existing import path in the API keeps resolving.
 */
export {
  countsTowardsReach,
  estimateAudience,
  labelNamesProduct,
  matchClients,
  matchesAsset,
  REACH_WINDOW_MS,
  type ClientAsset,
  type MatchResult,
} from '@vunvault/lib/advisory-matching';

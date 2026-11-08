/**
 * UAMP plan entitlements.
 *
 * Plan codes map to configurable limits. Billing rows live in shared `plans` /
 * `subscriptions`; this module is the product policy layer only.
 */

export interface UampEntitlements {
  planCode: string;
  maxMonitors: number;
  minIntervalSeconds: number;
  /** Days of check history retained. */
  retentionDays: number;
  maxStatusPages: number;
  maxTeamMembers: number;
  /** Monthly AI investigation budget (0 = disabled). */
  aiInvestigationsPerMonth: number;
  apiRequestsPerMinute: number;
}

const ENTITLEMENTS: Record<string, UampEntitlements> = {
  uamp_free: {
    planCode: 'uamp_free',
    maxMonitors: 5,
    minIntervalSeconds: 300,
    retentionDays: 7,
    maxStatusPages: 1,
    maxTeamMembers: 1,
    aiInvestigationsPerMonth: 5,
    apiRequestsPerMinute: 30,
  },
  uamp_starter: {
    planCode: 'uamp_starter',
    maxMonitors: 20,
    minIntervalSeconds: 60,
    retentionDays: 30,
    maxStatusPages: 3,
    maxTeamMembers: 3,
    aiInvestigationsPerMonth: 50,
    apiRequestsPerMinute: 60,
  },
  uamp_professional: {
    planCode: 'uamp_professional',
    maxMonitors: 100,
    minIntervalSeconds: 60,
    retentionDays: 90,
    maxStatusPages: 10,
    maxTeamMembers: 10,
    aiInvestigationsPerMonth: 300,
    apiRequestsPerMinute: 120,
  },
  uamp_business: {
    planCode: 'uamp_business',
    maxMonitors: 500,
    minIntervalSeconds: 30,
    retentionDays: 180,
    maxStatusPages: 50,
    maxTeamMembers: 25,
    aiInvestigationsPerMonth: 1000,
    apiRequestsPerMinute: 300,
  },
  uamp_agency: {
    planCode: 'uamp_agency',
    maxMonitors: 2000,
    minIntervalSeconds: 30,
    retentionDays: 365,
    maxStatusPages: 200,
    maxTeamMembers: 100,
    aiInvestigationsPerMonth: 5000,
    apiRequestsPerMinute: 600,
  },
};

export const DEFAULT_UAMP_ENTITLEMENTS = ENTITLEMENTS.uamp_free!;

export function entitlementsForPlan(planCode: string | null | undefined): UampEntitlements {
  if (!planCode) return DEFAULT_UAMP_ENTITLEMENTS;
  return ENTITLEMENTS[planCode] ?? DEFAULT_UAMP_ENTITLEMENTS;
}

/**
 * Resolve active UAMP plan code for an org from shared subscriptions + plans.
 * Falls back to null (free tier) when no active UAMP subscription exists.
 */
export async function resolveUampPlanCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  orgId: string,
): Promise<string | null> {
  const { plans, subscriptions } = await import('@vunvault/db');
  const { and, eq, like } = await import('drizzle-orm');

  try {
    const rows = await db
      .select({ code: plans.code })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.orgId, orgId),
          eq(subscriptions.status, 'active'),
          like(plans.code, 'uamp_%'),
        ),
      )
      .limit(1);
    return (rows[0]?.code as string | undefined) ?? null;
  } catch {
    return null;
  }
}

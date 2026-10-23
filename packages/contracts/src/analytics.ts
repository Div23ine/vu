import { z } from 'zod';

/**
 * First-party analytics contract. The event list is closed on purpose: the
 * browser cannot invent new event names into the table, and the consent gate
 * lives client-side in the web app (nothing is posted without an accepted
 * Analytics category).
 */
export const ANALYTICS_EVENTS = [
  'pricing_view',
  'tier_click',
  'checkout_start',
  'checkout_success',
  'sample_report_open',
  'sample_report_close',
] as const;

export const AnalyticsEventSchema = z.enum(ANALYTICS_EVENTS);
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

export const AnalyticsBodySchema = z.object({
  event: AnalyticsEventSchema,
  /** Small, non-identifying context (plan code, reference, tool). */
  meta: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type AnalyticsBody = z.infer<typeof AnalyticsBodySchema>;

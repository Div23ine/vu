import { z } from 'zod';
import { envelope, paginated, PageQuery, Uuid } from './common.js';
import {
  UampAlertChannelSchema,
  UampAiInvestigationStatusSchema,
  UampCheckResultStatusSchema,
  UampHttpMethodSchema,
  UampIncidentSeveritySchema,
  UampIncidentStatusSchema,
  UampMonitorStatusSchema,
  UampMonitorTypeSchema,
  UampStatusPageVisibilitySchema,
} from './enums.js';

/**
 * UAMP wire contracts — monitors, checks, incidents, status pages, AI.
 * All resources are org-scoped; the API resolves org from the JWT.
 */

export const UampHeaderSchema = z.object({
  name: z.string().trim().min(1).max(128),
  value: z.string().max(2048),
});
export type UampHeader = z.infer<typeof UampHeaderSchema>;

export const UampResponseAssertionSchema = z.object({
  expectedStatusCodes: z.array(z.number().int().min(100).max(599)).max(20).optional(),
  bodyContains: z.string().max(500).optional(),
  jsonPath: z.string().max(200).optional(),
  jsonEquals: z.unknown().optional(),
  maxLatencyMs: z.number().int().min(1).max(60_000).optional(),
});
export type UampResponseAssertion = z.infer<typeof UampResponseAssertionSchema>;

export const UampMonitorSchema = z.object({
  id: Uuid,
  orgId: Uuid,
  createdBy: Uuid.nullable().optional(),
  name: z.string().min(1).max(120),
  type: UampMonitorTypeSchema,
  status: UampMonitorStatusSchema,
  target: z.string().min(1).max(2048),
  method: UampHttpMethodSchema.nullable().optional(),
  intervalSeconds: z.number().int().min(30).max(86_400),
  timeoutMs: z.number().int().min(1000).max(60_000),
  locations: z.array(z.string().max(64)).max(20),
  headers: z.array(UampHeaderSchema).max(30),
  requestBody: z.string().max(32_768).nullable().optional(),
  assertions: UampResponseAssertionSchema.nullable().optional(),
  keyword: z.string().max(200).nullable().optional(),
  warnDaysBeforeExpiry: z.number().int().min(1).max(90).nullable().optional(),
  lastStatus: UampCheckResultStatusSchema.nullable().optional(),
  lastCheckedAt: z.string().datetime().nullable().optional(),
  lastLatencyMs: z.number().int().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UampMonitor = z.infer<typeof UampMonitorSchema>;

export const CreateUampMonitorBody = z.object({
  name: z.string().trim().min(1).max(120),
  type: UampMonitorTypeSchema,
  target: z.string().trim().min(1).max(2048),
  method: UampHttpMethodSchema.optional(),
  intervalSeconds: z.number().int().min(30).max(86_400).optional(),
  timeoutMs: z.number().int().min(1000).max(60_000).optional(),
  locations: z.array(z.string().max(64)).max(20).optional(),
  headers: z.array(UampHeaderSchema).max(30).optional(),
  requestBody: z.string().max(32_768).optional(),
  assertions: UampResponseAssertionSchema.optional(),
  keyword: z.string().max(200).optional(),
  warnDaysBeforeExpiry: z.number().int().min(1).max(90).optional(),
});
export type CreateUampMonitorBody = z.infer<typeof CreateUampMonitorBody>;

export const UpdateUampMonitorBody = CreateUampMonitorBody.partial().extend({
  status: UampMonitorStatusSchema.optional(),
});
export type UpdateUampMonitorBody = z.infer<typeof UpdateUampMonitorBody>;

export const UampMonitorListQuery = PageQuery.extend({
  status: UampMonitorStatusSchema.optional(),
  type: UampMonitorTypeSchema.optional(),
});
export type UampMonitorListQuery = z.infer<typeof UampMonitorListQuery>;

export const UampMonitorListResponse = paginated(UampMonitorSchema);
export const UampMonitorResponse = envelope(UampMonitorSchema);

export const UampCheckResultSchema = z.object({
  id: Uuid,
  orgId: Uuid,
  monitorId: Uuid,
  status: UampCheckResultStatusSchema,
  httpStatus: z.number().int().nullable().optional(),
  latencyMs: z.number().int().nullable().optional(),
  location: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  responseSnippet: z.string().nullable().optional(),
  checkedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type UampCheckResult = z.infer<typeof UampCheckResultSchema>;

export const UampCheckResultListQuery = PageQuery.extend({
  monitorId: Uuid.optional(),
  status: UampCheckResultStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type UampCheckResultListQuery = z.infer<typeof UampCheckResultListQuery>;

export const UampCheckResultListResponse = paginated(UampCheckResultSchema);

export const UampIncidentSchema = z.object({
  id: Uuid,
  orgId: Uuid,
  monitorId: Uuid,
  status: UampIncidentStatusSchema,
  severity: UampIncidentSeveritySchema,
  title: z.string().min(1).max(200),
  summary: z.string().nullable().optional(),
  startedAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable().optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  failureCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UampIncident = z.infer<typeof UampIncidentSchema>;

export const UampIncidentListQuery = PageQuery.extend({
  status: UampIncidentStatusSchema.optional(),
  severity: UampIncidentSeveritySchema.optional(),
  monitorId: Uuid.optional(),
});
export type UampIncidentListQuery = z.infer<typeof UampIncidentListQuery>;

export const UampIncidentListResponse = paginated(UampIncidentSchema);
export const UampIncidentResponse = envelope(UampIncidentSchema);

export const UpdateUampIncidentBody = z.object({
  status: UampIncidentStatusSchema.optional(),
  severity: UampIncidentSeveritySchema.optional(),
  summary: z.string().max(4000).optional(),
});
export type UpdateUampIncidentBody = z.infer<typeof UpdateUampIncidentBody>;

export const UampStatusPageSchema = z.object({
  id: Uuid,
  orgId: Uuid,
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(63),
  visibility: UampStatusPageVisibilitySchema,
  customDomain: z.string().nullable().optional(),
  monitorIds: z.array(Uuid),
  headline: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UampStatusPage = z.infer<typeof UampStatusPageSchema>;

export const CreateUampStatusPageBody = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/),
  visibility: UampStatusPageVisibilitySchema.optional(),
  customDomain: z.string().max(253).optional(),
  monitorIds: z.array(Uuid).max(100).optional(),
  headline: z.string().max(200).optional(),
});
export type CreateUampStatusPageBody = z.infer<typeof CreateUampStatusPageBody>;

export const UampStatusPageListResponse = paginated(UampStatusPageSchema);
export const UampStatusPageResponse = envelope(UampStatusPageSchema);

export const UampAlertRuleSchema = z.object({
  id: Uuid,
  orgId: Uuid,
  monitorId: Uuid.nullable().optional(),
  channel: UampAlertChannelSchema,
  destination: z.string().min(1).max(2048),
  enabled: z.boolean(),
  failureThreshold: z.number().int().min(1).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UampAlertRule = z.infer<typeof UampAlertRuleSchema>;

export const CreateUampAlertRuleBody = z.object({
  monitorId: Uuid.optional(),
  channel: UampAlertChannelSchema,
  destination: z.string().trim().min(1).max(2048),
  enabled: z.boolean().optional(),
  failureThreshold: z.number().int().min(1).max(20).optional(),
});
export type CreateUampAlertRuleBody = z.infer<typeof CreateUampAlertRuleBody>;

export const UampAiInvestigationSchema = z.object({
  id: Uuid,
  orgId: Uuid,
  incidentId: Uuid,
  status: UampAiInvestigationStatusSchema,
  model: z.string().nullable().optional(),
  report: z.string().nullable().optional(),
  findings: z.unknown().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type UampAiInvestigation = z.infer<typeof UampAiInvestigationSchema>;

export const UampAiInvestigationResponse = envelope(UampAiInvestigationSchema);

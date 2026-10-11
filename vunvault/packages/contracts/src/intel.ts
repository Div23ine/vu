import { z } from 'zod';
import { IsoDateTime, PageQuery, Uuid } from './common';
import {
  AdvisoryPatchStatusSchema,
  AdvisoryStatusSchema,
  BroadcastKindSchema,
  BroadcastStatusSchema,
  FindingSeveritySchema,
  ScopeCategorySchema,
} from './enums';
import type { FindingSeverity, ScopeCategory } from './enums';

/**
 * Zero-Day Intel desk: advisory authoring, NVD import, the emergency broadcast
 * gate and the client-facing projection.
 *
 * Permissions: `intel:read` for GETs, `intel:write` for drafts,
 * `intel:broadcast` for broadcast / rebroadcast / retract. `intel:broadcast` is
 * granted to `super_admin` and `admin` only.
 */

export const CVE_ID_PATTERN = /^CVE-\d{4}-\d{4,}$/;
export const CVE_ID_MESSAGE = 'Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.';
export const ADVISORY_TITLE_MESSAGE =
  'An advisory title is required before saving or broadcasting.';
export const ADVISORY_SEVERITY_MESSAGE = 'A severity level is required before broadcasting.';
export const ADVISORY_SCOPE_MESSAGE = 'Add at least one affected scope entry.';
export const ADVISORY_SUMMARY_MESSAGE = 'A client-facing summary is required before broadcasting.';
export const ADVISORY_REMEDIATION_MESSAGE = 'Remediation guidance is required before broadcasting.';
export const SEVERITY_CVSS_MISMATCH_MESSAGE =
  'The severity level does not match the CVSS base score band.';
export const BROADCAST_ACK_MESSAGE =
  'Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.';
export const BROADCAST_CONFIRM_MESSAGE = 'Type BROADCAST to confirm.';

/** Case-insensitive confirmation phrase for an emergency broadcast. */
export const BROADCAST_CONFIRM_PHRASE = 'BROADCAST';

/** CVSS base-score bands. The database enforces the same rule as a CHECK. */
export const CVSS_BANDS: Record<FindingSeverity, readonly [number, number]> = {
  critical: [9.0, 10.0],
  high: [7.0, 8.9],
  medium: [4.0, 6.9],
  low: [0.1, 3.9],
};

/** True when a severity agrees with a CVSS base score. */
export function severityMatchesCvss(severity: FindingSeverity, cvss: number): boolean {
  const band = CVSS_BANDS[severity];
  return cvss >= band[0] && cvss <= band[1];
}

export const SCOPE_CATEGORY_LABELS: Record<ScopeCategory, string> = {
  web_api: 'Web & API',
  network_edge: 'Network & Edge',
  endpoint_desktop: 'Endpoint / Desktop',
  cloud_containers: 'Cloud & Containers',
  mobile: 'Mobile',
  ot_ics: 'OT / ICS',
  identity_sso: 'Identity & SSO',
};

export const SEVERITY_CVSS_HINTS: Record<FindingSeverity, string> = {
  critical: 'CVSS 9.0 – 10.0',
  high: 'CVSS 7.0 – 8.9',
  medium: 'CVSS 4.0 – 6.9',
  low: 'CVSS 0.1 – 3.9',
};

export const PATCH_STATUS_LABELS: Record<z.infer<typeof AdvisoryPatchStatusSchema>, string> = {
  unpatched: 'Unpatched',
  patch_in_progress: 'Patch in progress',
  patched: 'Patched',
};

export const ADVISORY_STATUS_LABELS: Record<z.infer<typeof AdvisoryStatusSchema>, string> = {
  draft: 'Draft — Not Published',
  published: 'Published',
  retracted: 'Retracted',
};

/** The five acknowledgements that unlock the broadcast button. */
export const BROADCAST_ACK_LABELS = {
  severityCorrect: {
    title: 'Severity level is correct',
    description:
      'The assigned severity matches the CVSS base score and observed exploitation status.',
  },
  scopeComplete: {
    title: 'Affected scope is complete',
    description:
      'Every affected product, version range and platform is listed — no over- or under-matching.',
  },
  contentSafe: {
    title: 'Content is safe for client distribution',
    description:
      'No unredacted exploit code, internal credentials or third-party confidential data is included.',
  },
  remediationActionable: {
    title: 'Remediation guidance is actionable',
    description: 'Immediate mitigations and the permanent fix are both documented for clients.',
  },
  authorised: {
    title: 'I am authorised to issue emergency broadcasts',
    description:
      'This action is recorded against your administrator identity and cannot be revoked.',
  },
} as const;

export type BroadcastAckKey = keyof typeof BROADCAST_ACK_LABELS;

export const AdvisoryScopeEntry = z.object({
  label: z.string().min(1).max(120),
  category: ScopeCategorySchema.nullable(),
});
export type AdvisoryScopeEntry = z.infer<typeof AdvisoryScopeEntry>;

/**
 * A draft may be incomplete: everything except the CVE id, the exploitation
 * flags and the scope list is optional until the advisory is published.
 */
export const AdvisoryDraftBody = z.object({
  cveId: z.string().regex(CVE_ID_PATTERN, CVE_ID_MESSAGE),
  vendor: z.string().max(120).optional(),
  cvss: z
    .number()
    .min(0)
    .max(10)
    // One decimal place, checked on the decimal literal so 9.8 is not rejected
    // by floating-point drift the way `multipleOf(0.1)` would.
    .refine((value) => /^\d{1,2}(\.\d)?$/.test(String(value)), 'One decimal place only')
    .optional(),
  disclosureDate: z.string().date().optional(),
  severity: FindingSeveritySchema.optional(),
  weaponized: z.boolean(),
  publicPoc: z.boolean(),
  preAuth: z.boolean(),
  patchAvailable: z.boolean(),
  title: z.string().max(140).optional(),
  summary: z.string().max(1200).optional(),
  remediation: z.string().max(900).optional(),
  references: z.array(z.string().url()).default([]),
  scope: z.array(AdvisoryScopeEntry).max(50),
});
export type AdvisoryDraftBody = z.infer<typeof AdvisoryDraftBody>;

/** A draft that is complete enough to save-and-publish or broadcast. */
export const AdvisoryPublishable = AdvisoryDraftBody.superRefine((value, ctx) => {
  if (value.title === undefined || value.title.trim() === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: ADVISORY_TITLE_MESSAGE,
    });
  }
  if (value.severity === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['severity'],
      message: ADVISORY_SEVERITY_MESSAGE,
    });
  }
  if (value.scope.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scope'],
      message: ADVISORY_SCOPE_MESSAGE,
    });
  }
  if (value.summary === undefined || value.summary.trim() === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['summary'],
      message: ADVISORY_SUMMARY_MESSAGE,
    });
  }
  if (value.remediation === undefined || value.remediation.trim() === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['remediation'],
      message: ADVISORY_REMEDIATION_MESSAGE,
    });
  }
  if (
    value.cvss !== undefined &&
    value.severity !== undefined &&
    !severityMatchesCvss(value.severity, value.cvss)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['severity'],
      message: SEVERITY_CVSS_MISMATCH_MESSAGE,
    });
  }
});
export type AdvisoryPublishable = z.infer<typeof AdvisoryPublishable>;

export const AdvisoryAuthor = z.object({
  id: Uuid,
  label: z.string(),
});
export type AdvisoryAuthor = z.infer<typeof AdvisoryAuthor>;

/** Admin read model. */
export const Advisory = z.object({
  id: Uuid,
  cveId: z.string(),
  vendor: z.string().nullable(),
  cvss: z.number().nullable(),
  disclosureDate: z.string().date().nullable(),
  severity: FindingSeveritySchema.nullable(),
  weaponized: z.boolean(),
  publicPoc: z.boolean(),
  preAuth: z.boolean(),
  patchAvailable: z.boolean(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  remediation: z.string().nullable(),
  references: z.array(z.string()),
  scope: z.array(AdvisoryScopeEntry),
  status: AdvisoryStatusSchema,
  patchStatus: AdvisoryPatchStatusSchema,
  author: AdvisoryAuthor,
  lastSavedAt: IsoDateTime.nullable(),
  publishedAt: IsoDateTime.nullable(),
  lastBroadcastAt: IsoDateTime.nullable(),
  /** Distinct organisations that acknowledged within 24 h of the first broadcast. */
  reach: z.number().int().nonnegative().nullable(),
});
export type Advisory = z.infer<typeof Advisory>;

export const AdvisoryListQuery = PageQuery.extend({
  status: AdvisoryStatusSchema.optional(),
  severity: FindingSeveritySchema.optional(),
});
export type AdvisoryListQuery = z.infer<typeof AdvisoryListQuery>;

export const AdvisorySummary = z.object({
  activeZeroDays: z.number().int().nonnegative(),
  criticalSeverity: z.number().int().nonnegative(),
  unpatchedCritical: z.number().int().nonnegative(),
  weaponizedInWild: z.number().int().nonnegative(),
  advisoriesPublished: z.number().int().nonnegative(),
  broadcastThisMonth: z.number().int().nonnegative(),
  openDrafts: z.number().int().nonnegative(),
  escalatedDrafts: z.number().int().nonnegative(),
  dashboardsReached: z.number().int().nonnegative(),
  newClientsThisMonth: z.number().int().nonnegative(),
});
export type AdvisorySummary = z.infer<typeof AdvisorySummary>;

export const DRAFT_NOTE_VALUES = [
  'Unsaved changes',
  'Awaiting reviewer',
  'Needs scope entries',
] as const;

export const DraftListItem = z.object({
  id: Uuid,
  cveId: z.string(),
  title: z.string().nullable(),
  authorLabel: z.string(),
  lastSavedAt: IsoDateTime,
  /** Computed by the API from the draft's completeness. */
  note: z.enum(DRAFT_NOTE_VALUES).nullable(),
});
export type DraftListItem = z.infer<typeof DraftListItem>;

export const NvdImportQuery = z.object({
  cveId: z.string().regex(CVE_ID_PATTERN, CVE_ID_MESSAGE),
});
export type NvdImportQuery = z.infer<typeof NvdImportQuery>;

export const NvdImportResult = z.object({
  cveId: z.string(),
  vendor: z.string().nullable(),
  cvss: z.number().nullable(),
  severity: FindingSeveritySchema.nullable(),
  disclosureDate: z.string().date().nullable(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  references: z.array(z.string()),
});
export type NvdImportResult = z.infer<typeof NvdImportResult>;

export const BroadcastEstimate = z.object({
  dashboards: z.number().int().nonnegative(),
  emailContacts: z.number().int().nonnegative(),
  smsContacts: z.number().int().nonnegative(),
  incidentCommanders: z.number().int().nonnegative(),
});
export type BroadcastEstimate = z.infer<typeof BroadcastEstimate>;

export const BroadcastAck = z.object({
  severityCorrect: z.boolean(),
  scopeComplete: z.boolean(),
  contentSafe: z.boolean(),
  remediationActionable: z.boolean(),
  authorised: z.boolean(),
});
export type BroadcastAck = z.infer<typeof BroadcastAck>;

/**
 * The emergency-broadcast gate. All five acknowledgements must be true AND the
 * operator must type the confirmation phrase (matched case-insensitively).
 */
export const EmergencyBroadcastBody = z
  .object({
    ack: BroadcastAck,
    confirmPhrase: z.string(),
  })
  .superRefine((value, ctx) => {
    const acknowledgements = Object.keys(BROADCAST_ACK_LABELS) as BroadcastAckKey[];
    if (!acknowledgements.every((key) => value.ack[key] === true)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ack'],
        message: BROADCAST_ACK_MESSAGE,
      });
    }
    if (value.confirmPhrase.trim().toUpperCase() !== BROADCAST_CONFIRM_PHRASE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPhrase'],
        message: BROADCAST_CONFIRM_MESSAGE,
      });
    }
  });
export type EmergencyBroadcastBody = z.infer<typeof EmergencyBroadcastBody>;

export const RetractBody = z.object({
  note: z.string().min(10).max(500),
});
export type RetractBody = z.infer<typeof RetractBody>;

export const PatchStatusBody = z.object({
  patchStatus: AdvisoryPatchStatusSchema,
});
export type PatchStatusBody = z.infer<typeof PatchStatusBody>;

/** Delivery progress of one broadcast. Counters advance; nothing else changes. */
export const BroadcastRecord = z.object({
  id: Uuid,
  advisoryId: Uuid,
  kind: BroadcastKindSchema,
  status: BroadcastStatusSchema,
  triggeredByLabel: z.string(),
  audienceDashboards: z.number().int().nonnegative(),
  emailContacts: z.number().int().nonnegative(),
  smsContacts: z.number().int().nonnegative(),
  sentDashboards: z.number().int().nonnegative(),
  sentEmail: z.number().int().nonnegative(),
  sentSms: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  createdAt: IsoDateTime,
  finishedAt: IsoDateTime.nullable(),
});
export type BroadcastRecord = z.infer<typeof BroadcastRecord>;

/** What the client dashboard shows. The source line is fixed product copy. */
export const ClientAdvisory = z.object({
  id: Uuid,
  cveId: z.string(),
  title: z.string(),
  severity: FindingSeveritySchema,
  scope: z.array(AdvisoryScopeEntry),
  summary: z.string(),
  remediation: z.string(),
  references: z.array(z.string()),
  patchStatus: AdvisoryPatchStatusSchema,
  publishedAt: IsoDateTime,
  source: z.literal('VUNVAULT Intelligence'),
  acknowledged: z.boolean(),
});
export type ClientAdvisory = z.infer<typeof ClientAdvisory>;

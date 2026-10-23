import { z } from 'zod';
import { IsoDateTime, PageQuery, Uuid } from './common';
import { ContactCategorySchema, ContactStatusSchema } from './enums';
import type { ContactCategory } from './enums';

/**
 * Public contact intake and cookie consent.
 *
 * Both are unauthenticated, so both are rate limited at the API and store a
 * hashed source address rather than a raw IP. Consent is append-only: a change of
 * mind is a new record, never an edit.
 */

export const CONSENT_REQUIRED_MESSAGE = 'Consent is required';

export const ContactBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  organization: z.string().optional(),
  category: ContactCategorySchema,
  subject: z.string().min(3),
  message: z.string().min(10).max(5000),
  /** The checkbox is mandatory; anything other than `true` is rejected. */
  consent: z.literal(true, {
    errorMap: () => ({ message: CONSENT_REQUIRED_MESSAGE }),
  }),
});
export type ContactBody = z.infer<typeof ContactBody>;

/** `{ data: { id } }` — the only thing a contact submission reveals. */
export const ContactCreated = z.object({
  data: z.object({ id: Uuid }),
});
export type ContactCreated = z.infer<typeof ContactCreated>;

export const ContactCategories = z.object({
  /** Cannot be declined — the platform does not work without it. */
  strictlyNecessary: z.literal(true),
  analytics: z.boolean(),
  marketing: z.boolean(),
  functional: z.boolean(),
});
export type ContactCategories = z.infer<typeof ContactCategories>;

export const ConsentBody = z.object({
  categories: ContactCategories,
  policyVersion: z.string().min(1),
});
export type ConsentBody = z.infer<typeof ConsentBody>;

/** The two states the consent banner can post without a custom selection. */
export const CONSENT_ACCEPT_ALL = {
  strictlyNecessary: true,
  analytics: true,
  marketing: true,
  functional: true,
} as const satisfies ContactCategories;

export const CONSENT_ESSENTIAL_ONLY = {
  strictlyNecessary: true,
  analytics: false,
  marketing: false,
  functional: false,
} as const satisfies ContactCategories;

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  penetration_testing_request: 'Penetration Testing Request',
  vulnerability_report: 'Vulnerability / Bug Report',
  journalist_blogger_profile_request: 'Journalist / Blogger Profile Request',
  whistleblower_tip: 'Whistleblower Tip',
  general_support: 'General Support',
};

/**
 * Admin contact inbox + client directory (Task 40f).
 *
 * The public form (above) stores messages; these views let an administrator
 * read and triage them — including the Verified-Blogger requests, whose badge
 * grant needs the client directory search. `message` is returned in full only
 * behind `support:handle`; the raw IP hash never leaves the database.
 */

export const ContactMessageView = z.object({
  id: Uuid,
  name: z.string(),
  email: z.string().email(),
  organization: z.string().nullable(),
  category: ContactCategorySchema,
  /** `CONTACT_CATEGORY_LABELS[category]` — minted by the API, never by the client. */
  categoryLabel: z.string(),
  subject: z.string(),
  message: z.string(),
  status: ContactStatusSchema,
  assignedTo: z.object({ id: Uuid, label: z.string() }).nullable(),
  createdAt: IsoDateTime,
});
export type ContactMessageView = z.infer<typeof ContactMessageView>;

/** `q` searches name, email, organization and subject (ILIKE). */
export const ContactListQuery = PageQuery.extend({
  status: ContactStatusSchema.optional(),
  category: ContactCategorySchema.optional(),
});
export type ContactListQuery = z.infer<typeof ContactListQuery>;

export const CONTACT_TRIAGE_EMPTY_MESSAGE = 'Provide at least one of status or assignedTo';

export const ContactTriageBody = z
  .object({
    status: ContactStatusSchema.optional(),
    /** A staff profile id, or `null` to unassign. */
    assignedTo: Uuid.nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.assignedTo !== undefined, {
    message: CONTACT_TRIAGE_EMPTY_MESSAGE,
  });
export type ContactTriageBody = z.infer<typeof ContactTriageBody>;

export const ClientDirectoryItem = z.object({
  id: Uuid,
  fullName: z.string(),
  email: z.string().email(),
  company: z.string().nullable(),
  clientCode: z.string().nullable(),
  verifiedBlogger: z.boolean(),
});
export type ClientDirectoryItem = z.infer<typeof ClientDirectoryItem>;

/** Boolean query flags arrive as strings; only the two literals are accepted. */
export const ClientDirectoryQuery = PageQuery.extend({
  verifiedBlogger: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type ClientDirectoryQuery = z.input<typeof ClientDirectoryQuery>;
export type ClientDirectoryFilter = z.output<typeof ClientDirectoryQuery>;

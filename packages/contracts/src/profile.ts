import { z } from 'zod';
import { IsoDateTime, Uuid } from './common.js';
import { IndustrySchema, SubscriptionStatusSchema } from './enums.js';

/** The client portal's "My Profile" read model. */
export const ClientProfile = z.object({
  id: Uuid,
  fullName: z.string(),
  jobTitle: z.string().nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  /** Human client code, e.g. `VV-CL-48210`. */
  clientCode: z.string().regex(/^VV-CL-\d{5,}$/),
  company: z.object({
    name: z.string(),
    primaryDomain: z.string().nullable(),
    industry: IndustrySchema.nullable(),
  }),
  plan: z
    .object({
      name: z.string(),
      status: SubscriptionStatusSchema,
    })
    .nullable(),
  stats: z.object({
    engagements: z.number().int().nonnegative(),
    openFindings: z.number().int().nonnegative(),
    nextAssessmentInDays: z.number().int().nonnegative().nullable(),
  }),
  updatedAt: IsoDateTime,
});
export type ClientProfile = z.infer<typeof ClientProfile>;

export const UpdateProfileBody = z.object({
  fullName: z.string().min(2),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  company: z.object({
    name: z.string().min(2),
    primaryDomain: z.string().optional(),
    industry: IndustrySchema.optional(),
  }),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

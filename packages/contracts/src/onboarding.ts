import { z } from 'zod';
import { IsoDateTime } from './common.js';
import { CareerRoleSchema, EntityTypeSchema, RecoveryQuestionSchema } from './enums.js';
import type { CareerRole, EntityType } from './enums.js';

/**
 * The three-step client onboarding wizard.
 *
 * Step 1 identity, step 2 what they do, step 3 recovery question plus the three
 * declarations. All three declarations are `z.literal(true)`: the wizard cannot
 * submit until every box is ticked.
 */

export const CAREER_LABELS: Record<CareerRole, string> = {
  student: 'Student',
  business_owner: 'Business Owner',
  cybersecurity_professional: 'Cybersecurity Professional',
  independent_specialist: 'Independent Specialist',
};

export const CAREER_DESCRIPTIONS: Record<CareerRole, string> = {
  student: 'Learning tracks, labs and free certificates.',
  business_owner: 'Starter scans and plain-language reporting.',
  cybersecurity_professional: 'Full-scope pentesting and purple-team work.',
  independent_specialist: 'Consulting, audits and client engagements.',
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  individual: 'Individual',
  company: 'Company',
  corporation: 'Corporation',
};

export const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
  individual: 'Personal account, personal scope.',
  company: 'Registered business or startup.',
  corporation: 'Enterprise, group or public entity.',
};

export const MIN_AGE_YEARS = 16;
export const MIN_AGE_MESSAGE = 'You must be at least 16 years old.';
export const EMAIL_MATCH_MESSAGE = 'Email addresses must match.';

/** E.164: a leading `+`, then 1–15 digits, never starting with 0. */
export const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

/** True when the given date of birth is at least 16 years before `now` (UTC). */
export function isAtLeast16(dateOfBirth: string, now: Date = new Date()): boolean {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return false;
  const cutoff = Date.UTC(
    now.getUTCFullYear() - MIN_AGE_YEARS,
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return birth.getTime() <= cutoff;
}

export const OnboardingStep1 = z
  .object({
    fullName: z.string().min(2),
    dateOfBirth: z
      .string()
      .date()
      .refine((value) => isAtLeast16(value), MIN_AGE_MESSAGE),
    phone: z
      .string()
      .regex(E164_PATTERN, 'Use the international form, e.g. +254712345678')
      .optional(),
    email: z.string().email(),
    emailConfirm: z.string().email(),
  })
  .refine((value) => value.email === value.emailConfirm, {
    path: ['emailConfirm'],
    message: EMAIL_MATCH_MESSAGE,
  });
export type OnboardingStep1 = z.infer<typeof OnboardingStep1>;

export const OnboardingStep2 = z.object({
  career: CareerRoleSchema,
  entity: EntityTypeSchema,
});
export type OnboardingStep2 = z.infer<typeof OnboardingStep2>;

export const OnboardingStep3 = z.object({
  recoveryQuestion: RecoveryQuestionSchema,
  /** Stored as a memory-hard hash of the lower-cased, trimmed answer. */
  recoveryAnswer: z.string().min(3),
  declarations: z.object({
    infoAccurate: z.literal(true),
    authorisedTesting: z.literal(true),
    termsAccepted: z.literal(true),
  }),
});
export type OnboardingStep3 = z.infer<typeof OnboardingStep3>;

export const OnboardingSubmitBody = z.object({
  step1: OnboardingStep1,
  step2: OnboardingStep2,
  step3: OnboardingStep3,
});
export type OnboardingSubmitBody = z.infer<typeof OnboardingSubmitBody>;

export const OnboardingStatus = z.object({
  completed: z.boolean(),
  completedAt: IsoDateTime.nullable(),
});
export type OnboardingStatus = z.infer<typeof OnboardingStatus>;

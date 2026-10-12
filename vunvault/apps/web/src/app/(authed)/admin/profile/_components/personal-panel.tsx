'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Contact, IdCard, Save, UserRound } from 'lucide-react';
import { z } from 'zod';
import type { ProfileSettings } from '@vunvault/contracts';
import {
  LANGUAGES,
  LanguageSchema,
  TIMEZONES,
  TimezoneSchema,
  UpdateProfileSettingsBody,
} from '@vunvault/contracts';
import { cn, formatUtcClock, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { useUpdateProfileSettings } from '../_hooks/use-account-settings';

/**
 * Personal Details panel (Task 83c) — RHF + Zod over the contract's
 * `UpdateProfileSettingsBody`.
 *
 * `Work Email` is rendered read-only and is deliberately NOT in the payload:
 * the contract omits it because the address is owned by Supabase Auth, so the
 * UI cannot offer to change what the API would refuse.
 *
 * The select options come straight from `TIMEZONES` and `LANGUAGES`, so the
 * labels here and the values the API validates are the same record.
 *
 * Save is disabled while the form is pristine (the spec's unsaved-changes
 * guard) and Reset restores the last saved values rather than the originals,
 * so a save followed by an edit resets to what the server holds.
 *
 * AUTHORED copy (documented): the contract supplies no field-level messages for
 * these three strings, so the validation lines below are factual rather than
 * quoted. Every toast is verbatim from the spec.
 */

const BIO_LIMIT = 400;

const personalFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  jobTitle: z.string(),
  phone: z.string(),
  timezone: TimezoneSchema,
  language: LanguageSchema,
  bio: z.string().max(BIO_LIMIT),
});

export type PersonalFormValues = z.infer<typeof personalFormSchema>;

const TIMEZONE_OPTIONS = Object.keys(TIMEZONES) as (keyof typeof TIMEZONES)[];
const LANGUAGE_OPTIONS = Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[];

function toFormValues(profile: ProfileSettings): PersonalFormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName,
    jobTitle: profile.jobTitle ?? '',
    phone: profile.phone ?? '',
    timezone: profile.timezone,
    language: profile.language,
    bio: profile.bio ?? '',
  };
}

/** What the page's head actions drive on this panel. */
export interface PersonalPanelControls {
  submit(): void;
  reset(): void;
}

/**
 * Stable empty defaults.
 *
 * The settings query is in flight on the first paint, so `profile` is null and
 * there is nothing to seed from. Passing `undefined` as `defaultValues` would
 * leave every field unregistered and `watch('bio')` would return `undefined`,
 * crashing the counter. The panel renders from these instead, and `reset()`
 * re-seeds the moment the profile lands.
 *
 * The timezone and language defaults are the first entry of each contract
 * record rather than literals, so they can never name a value the API rejects.
 */
const EMPTY_PERSONAL: PersonalFormValues = {
  firstName: '',
  lastName: '',
  displayName: '',
  jobTitle: '',
  phone: '',
  timezone: TIMEZONE_OPTIONS[0] ?? 'Africa/Nairobi',
  language: LANGUAGE_OPTIONS[0] ?? 'en-GB',
  bio: '',
};

export interface PersonalPanelProps {
  profile: ProfileSettings | null;
  /** Lets the page's `Save All Changes` / `Discard Changes` drive this panel. */
  onReady(controls: PersonalPanelControls): void;
}

export function PersonalPanel({ profile, onReady }: PersonalPanelProps) {
  const update = useUpdateProfileSettings();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<PersonalFormValues>({
    resolver: zodResolver(personalFormSchema),
    defaultValues: profile === null ? EMPTY_PERSONAL : toFormValues(profile),
    mode: 'onBlur',
  });

  // Re-seed once the settings query lands (and after every save, so `isDirty`
  // measures against what the server holds, not the first paint).
  useEffect(() => {
    if (profile === null) return;
    reset(toFormValues(profile));
  }, [profile, reset]);

  const bio = watch('bio');

  const submit = handleSubmit((values) => {
    const parsed = UpdateProfileSettingsBody.safeParse(values);
    if (!parsed.success) return;
    update.mutate(parsed.data, {
      onSuccess: () =>
        toast({
          kind: 'ok',
          title: 'Personal details saved',
          message: `Profile updated at ${formatUtcClock(new Date())} and written to the audit log.`,
        }),
      onError: (error) =>
        toast({
          kind: 'crit',
          title: 'Could not save personal details',
          message: isApiError(error) ? error.message : 'Please try again.',
        }),
    });
  });

  // Hand the page a way to drive this panel from the head actions. Assigning
  // into a ref (not state) keeps this from re-rendering the page.
  useEffect(() => {
    onReady({ submit: () => void submit(), reset: silentReset });
  });

  const onReset = (): void => {
    if (profile !== null) reset(toFormValues(profile));
    toast({
      kind: 'info',
      title: 'Personal details reset',
      message: 'Restored to the last saved values.',
    });
  };

  /** Reset WITHOUT the panel's own toast — the page's Discard owns that copy. */
  const silentReset = (): void => {
    if (profile !== null) reset(toFormValues(profile));
  };

  return (
    <section
      className="adm-card ps-panel"
      id="ps-panel-personal"
      role="tabpanel"
      aria-labelledby="ps-tab-personal"
      tabIndex={0}
    >
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <UserRound size={15} aria-hidden="true" />
            Personal Details
          </h2>
          <p className="adm-card-note">
            How your name and contact information appear across the VUNVAULT platform and in
            client-facing communication.
          </p>
        </div>
        <span className="adm-tag adm-tag--ok">Verified</span>
      </div>
      <div className="adm-card-body">
        <form className="ps-form" id="ps-personal-form" onSubmit={submit} noValidate>
          <fieldset className="ps-fieldset">
            <legend className="ps-legend">
              <IdCard size={12} aria-hidden="true" />
              Identity
            </legend>
            <div className="ps-row">
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-first">
                  <span>
                    First Name
                    <span className="ps-label-req" aria-hidden="true">
                      *
                    </span>
                  </span>
                </label>
                <input
                  id="ps-first"
                  className={cn('ps-input', errors.firstName === undefined ? undefined : 'is-invalid')}
                  type="text"
                  autoComplete="given-name"
                  required
                  aria-invalid={errors.firstName === undefined ? undefined : true}
                  {...register('firstName')}
                />
                {errors.firstName === undefined ? null : (
                  <span className="ps-error">{errors.firstName.message}</span>
                )}
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-last">
                  <span>
                    Last Name
                    <span className="ps-label-req" aria-hidden="true">
                      *
                    </span>
                  </span>
                </label>
                <input
                  id="ps-last"
                  className={cn('ps-input', errors.lastName === undefined ? undefined : 'is-invalid')}
                  type="text"
                  autoComplete="family-name"
                  required
                  aria-invalid={errors.lastName === undefined ? undefined : true}
                  {...register('lastName')}
                />
                {errors.lastName === undefined ? null : (
                  <span className="ps-error">{errors.lastName.message}</span>
                )}
              </div>
            </div>
            <div className="ps-row">
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-display">
                  <span>Display Name</span>
                  <span className="ps-hint">Shown in the audit log</span>
                </label>
                <input
                  id="ps-display"
                  className={cn(
                    'ps-input',
                    errors.displayName === undefined ? undefined : 'is-invalid',
                  )}
                  type="text"
                  autoComplete="nickname"
                  aria-invalid={errors.displayName === undefined ? undefined : true}
                  {...register('displayName')}
                />
                {errors.displayName === undefined ? null : (
                  <span className="ps-error">{errors.displayName.message}</span>
                )}
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-jobtitle">
                  <span>Job Title</span>
                </label>
                <input
                  id="ps-jobtitle"
                  className="ps-input"
                  type="text"
                  autoComplete="organization-title"
                  {...register('jobTitle')}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="ps-fieldset">
            <legend className="ps-legend">
              <Contact size={12} aria-hidden="true" />
              Contact
            </legend>
            <div className="ps-row">
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-email">
                  <span>
                    Work Email
                    <span className="ps-label-req" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <span className="ps-hint">@vunvault.com domain</span>
                </label>
                {/* Owned by Supabase Auth: rendered, never submitted. */}
                <input
                  id="ps-email"
                  className="ps-input"
                  type="email"
                  value={profile?.email ?? ''}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-phone">
                  <span>Direct Phone</span>
                  <span className="ps-hint">Encrypted at rest</span>
                </label>
                <input
                  id="ps-phone"
                  className="ps-input"
                  type="tel"
                  autoComplete="tel"
                  {...register('phone')}
                />
              </div>
            </div>
            <div className="ps-row">
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-timezone">
                  <span>Time Zone</span>
                </label>
                <select id="ps-timezone" className="ps-select" {...register('timezone')}>
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {TIMEZONES[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-language">
                  <span>Interface Language</span>
                </label>
                <select id="ps-language" className="ps-select" {...register('language')}>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {LANGUAGES[option]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="ps-fieldset">
            <legend className="ps-legend">
              <UserRound size={12} aria-hidden="true" />
              Biography
            </legend>
            <div className="ps-field">
              <div className="ps-label-row">
                <label className="ps-label" htmlFor="ps-bio">
                  <span>Short Biography</span>
                </label>
                <span
                  className={cn('ps-counter', bio.length >= BIO_LIMIT ? 'is-full' : undefined)}
                >
                  {bio.length} / {BIO_LIMIT}
                </span>
              </div>
              <textarea
                id="ps-bio"
                className={cn('ps-textarea', errors.bio === undefined ? undefined : 'is-invalid')}
                rows={4}
                maxLength={BIO_LIMIT}
                {...register('bio')}
              />
              {errors.bio === undefined ? null : (
                <span className="ps-error">{errors.bio.message}</span>
              )}
            </div>
          </fieldset>

          <div className="ps-form-actions">
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onReset}>
              Reset
            </button>
            <button
              type="submit"
              className="adm-btn adm-btn-primary"
              disabled={!isDirty || update.isPending}
            >
              <Save size={15} aria-hidden="true" />
              <span>Save Personal Details</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

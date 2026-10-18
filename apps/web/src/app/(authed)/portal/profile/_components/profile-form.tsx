'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Check, Save, UserRound } from 'lucide-react';
import { INDUSTRY_LABELS, type Industry, type UpdateProfileBody } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { useClientProfile, useUpdateClientProfile } from '../_hooks/use-client-profile';

/**
 * Profile form — one RHF form over the two design cards
 * (Personal Details + Company Details), saved through
 * `PATCH /api/v1/profile` with the contract's `UpdateProfileBody`. The
 * design's localStorage persistence is replaced by the API; the work
 * email is server-owned and renders read-only (`aria-readonly`), never in
 * the PATCH body.
 *
 * Validation: the design's combined `Please complete name, role and
 * email` is split into the spec's per-field messages (`Please enter your
 * full name.` / `Please enter your job title.`); the remaining messages are
 * the contract defaults. `400 validation_failed` maps the Zod `details`
 * paths onto fields.
 *
 * Dirty-state guard: both Save buttons stay disabled until the form is
 * dirty, and a `beforeunload` warning protects a dirty form (removed on
 * save/unmount). After a save the company card's footer flips to
 * `Last saved just now` (the design's `· stored locally on this device`
 * tail is dropped — it is no longer true).
 */

const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.'),
  jobTitle: z.string().trim().min(1, 'Please enter your job title.'),
  phone: z.string().trim().optional(),
  companyName: z.string().trim().min(2),
  primaryDomain: z.string().trim().optional(),
  industry: z.string().optional(),
});

type ProfileFormValues = z.input<typeof profileFormSchema>;

const INDUSTRY_ORDER = Object.keys(INDUSTRY_LABELS) as Industry[];

/** `18 Aug 2026, 09:14 UTC` — the design's footer stamp (authored format). */
function formatUpdatedStamp(iso: string): string {
  const date = new Date(iso);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[date.getUTCMonth()] ?? '';
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export function ProfileForm() {
  const profile = useClientProfile();
  const update = useUpdateClientProfile();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const data = profile.data;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values:
      data === undefined
        ? undefined
        : {
            fullName: data.fullName,
            jobTitle: data.jobTitle ?? '',
            phone: data.phone ?? '',
            companyName: data.company.name,
            primaryDomain: data.company.primaryDomain ?? '',
            industry: data.company.industry ?? '',
          },
  });

  // Dirty-state guard: warn before abandoning unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const onSubmit = handleSubmit(async (values) => {
    const body: UpdateProfileBody = {
      fullName: values.fullName,
      jobTitle: values.jobTitle === '' ? undefined : values.jobTitle,
      phone: values.phone === '' ? undefined : values.phone,
      company: {
        name: values.companyName,
        primaryDomain: values.primaryDomain === '' ? undefined : values.primaryDomain,
        industry: values.industry === '' ? undefined : (values.industry as Industry),
      },
    };
    try {
      await update.mutateAsync(body);
      setSavedAt(new Date().toISOString());
      reset(values); // clears the dirty flag (and the beforeunload guard)
      toast({
        kind: 'ok',
        title: 'Personal details saved',
        message: 'Your profile has been updated.',
      });
    } catch (submitError) {
      if (
        isApiError(submitError) &&
        submitError.status === 400 &&
        Array.isArray(submitError.details)
      ) {
        for (const detail of submitError.details) {
          const issue = detail as { path?: unknown; message?: unknown };
          if (!Array.isArray(issue.path) || issue.path.length === 0) continue;
          if (typeof issue.message !== 'string') continue;
          const field = issue.path.join('.');
          // The API validates UpdateProfileBody paths (fullName, jobTitle,
          // company.name, …) — map the flat form fields onto them.
          const mapped =
            field === 'company.name'
              ? 'companyName'
              : field === 'company.primaryDomain'
                ? 'primaryDomain'
                : field === 'company.industry'
                  ? 'industry'
                  : field;
          if (
            mapped === 'fullName' ||
            mapped === 'jobTitle' ||
            mapped === 'phone' ||
            mapped === 'companyName' ||
            mapped === 'primaryDomain' ||
            mapped === 'industry'
          ) {
            setError(mapped, { message: issue.message });
          }
        }
      }
      toast({ kind: 'crit', title: 'Could not save', message: 'Please try again.' });
    }
  });

  const savePersonal = useCallback(() => {
    // Both buttons submit the ONE form (the API has a single PATCH); the
    // personal card's button is a shortcut, not a partial update.
    document
      .getElementById('vvp-profile-form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }, []);

  if (profile.isLoading || data === undefined) {
    return null; // the hero shows the loading state; the form mounts with values
  }

  return (
    <form id="vvp-profile-form" onSubmit={onSubmit} noValidate>
      <div className="vvp-card">
        <div className="vvp-card-head">
          <span className="vvp-card-icon" aria-hidden="true">
            <UserRound size={20} />
          </span>
          <div>
            <h2 className="vvp-card-title">Personal Details</h2>
            <p className="vvp-card-sub">
              Used for engagement correspondence, report delivery and emergency contact.
            </p>
          </div>
        </div>
        <div className="vvp-grid">
          <div className="vvp-field">
            <label htmlFor="pf-fullname">Full Name</label>
            <input
              id="pf-fullname"
              className={cn('vvp-input', errors.fullName !== undefined && 'is-invalid')}
              type="text"
              autoComplete="name"
              aria-invalid={errors.fullName !== undefined}
              {...register('fullName')}
            />
            {errors.fullName !== undefined ? (
              <span className="vvp-error" role="alert">
                {errors.fullName.message}
              </span>
            ) : null}
          </div>
          <div className="vvp-field">
            <label htmlFor="pf-jobtitle">Role / Title</label>
            <input
              id="pf-jobtitle"
              className={cn('vvp-input', errors.jobTitle !== undefined && 'is-invalid')}
              type="text"
              autoComplete="organization-title"
              aria-invalid={errors.jobTitle !== undefined}
              {...register('jobTitle')}
            />
            {errors.jobTitle !== undefined ? (
              <span className="vvp-error" role="alert">
                {errors.jobTitle.message}
              </span>
            ) : null}
          </div>
          <div className="vvp-field">
            <label htmlFor="pf-email">Work Email</label>
            <input
              id="pf-email"
              className="vvp-input"
              type="email"
              value={data.email}
              readOnly
              aria-readonly="true"
            />
          </div>
          <div className="vvp-field">
            <label htmlFor="pf-phone">Phone Number</label>
            <input
              id="pf-phone"
              className="vvp-input"
              type="tel"
              autoComplete="tel"
              {...register('phone')}
            />
          </div>
        </div>
        <div className="vvp-actions">
          <p className="vvp-actions-meta" id="vvp-personal-meta">
            Saves your name, role and contact details, then refreshes your profile header.
          </p>
          <div className="vvp-actions-buttons">
            <button
              type="button"
              className="vvp-btn vvp-btn--primary"
              id="vvp-save-personal-btn"
              disabled={!isDirty || isSubmitting}
              onClick={savePersonal}
            >
              <Save size={15} aria-hidden="true" />
              <span>Save Personal Details</span>
            </button>
          </div>
        </div>
      </div>

      <div className="vvp-card">
        <div className="vvp-card-head">
          <span className="vvp-card-icon" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <div>
            <h2 className="vvp-card-title">Company Details</h2>
            <p className="vvp-card-sub">
              Defines the authorised scope boundary for all VUNVAULT testing activity.
            </p>
          </div>
        </div>
        <div className="vvp-grid">
          <div className="vvp-field">
            <label htmlFor="pf-company">Organization / Company Name</label>
            <input
              id="pf-company"
              className={cn('vvp-input', errors.companyName !== undefined && 'is-invalid')}
              type="text"
              autoComplete="organization"
              aria-invalid={errors.companyName !== undefined}
              {...register('companyName')}
            />
            {errors.companyName !== undefined ? (
              <span className="vvp-error" role="alert">
                {errors.companyName.message}
              </span>
            ) : null}
          </div>
          <div className="vvp-field">
            <label htmlFor="pf-domain">Primary Target Domain / URL</label>
            <input
              id="pf-domain"
              className="vvp-input"
              type="text"
              autoComplete="off"
              {...register('primaryDomain')}
            />
            <span className="vvp-hint">Only assets you own or are authorised to test.</span>
          </div>
          <div className="vvp-field vvp-col-span-2">
            <label htmlFor="pf-industry">Industry</label>
            <select
              id="pf-industry"
              className={cn('vvp-select', errors.industry !== undefined && 'is-invalid')}
              aria-invalid={errors.industry !== undefined}
              {...register('industry')}
            >
              <option value="">Select industry…</option>
              {INDUSTRY_ORDER.map((industry) => (
                <option key={industry} value={industry}>
                  {INDUSTRY_LABELS[industry]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="vvp-actions">
          <p className="vvp-actions-meta">
            {savedAt !== null ? (
              <span id="vvp-last-saved">Last saved just now</span>
            ) : (
              <>
                Last updated <span id="vvp-last-updated">{formatUpdatedStamp(data.updatedAt)}</span>
              </>
            )}
          </p>
          <div className="vvp-actions-buttons">
            <button type="reset" className="vvp-btn vvp-btn--ghost" id="vvp-reset-btn">
              Discard Changes
            </button>
            <button
              type="submit"
              className="vvp-btn vvp-btn--primary"
              id="vvp-save-btn"
              disabled={!isDirty || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="vvp-btn-spinner" aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              <span>Save Profile Settings</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

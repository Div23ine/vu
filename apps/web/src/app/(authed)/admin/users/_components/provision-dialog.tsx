'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, UserPlus } from 'lucide-react';
import { z } from 'zod';
import type { ProvisionInviteBody, StaffRole } from '@vunvault/contracts';
import {
  ACCESS_TIER_LABELS,
  AccessTierSchema,
  ROLE_LABELS,
  StaffRoleSchema,
  StaffTeamSchema,
  TEAM_LABELS,
} from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import { useSession } from '../../../../../lib/session';
import { useProvisionInvite } from '../_hooks/use-provision';
import '../_styles/users.css';

/**
 * Provision New Team Member — the scoped invitation form on RHF +
 * Zod (`ProvisionInviteBody`): the verbatim field labels and helpers, the
 * staff-only role select (Super Administrator / Administrator are disabled
 * unless the CALLER is a super admin — the API enforces the same rule), the
 * six staff teams, access tier, review date, scope notes and the onboarding
 * checklist whose three tickable items drive the live
 * `<n> outstanding security requirement(s)` counter and the
 * `Provisioning incomplete` / `Send Secure Invitation` button states.
 * `Save Draft` posts the same body with `draft: true`.
 */

const formSchema = z.object({
  fullName: z.string().min(2, 'Full name is required.'),
  email: z
    .string()
    .email('Use a valid @vunvault.com work email.')
    .refine((value) => value.endsWith('@vunvault.com'), {
      message: 'Use a valid @vunvault.com work email.',
    }),
  jobTitle: z.string(),
  baseLocation: z.string(),
  role: StaffRoleSchema,
  team: StaffTeamSchema,
  accessTier: AccessTierSchema,
  accessReviewDue: z.string(),
  scopeNotes: z.string().max(1000),
  ndaOnFile: z.boolean(),
  backgroundVerified: z.boolean(),
  trainingAcknowledged: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const ROLE_OPTIONS = StaffRoleSchema.options;
const TEAM_OPTIONS = StaffTeamSchema.options;
const TIER_OPTIONS = AccessTierSchema.options;

/** Roles only a super admin may grant (the API enforces; the UI disables). */
const PRIVILEGED_ROLES: ReadonlySet<StaffRole> = new Set<StaffRole>(['super_admin', 'admin']);

interface ProvisionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ProvisionDialog({ open, onOpenChange }: ProvisionDialogProps) {
  const { user } = useSession();
  const isSuperAdmin = user?.role === 'super_admin';
  const provision = useProvisionInvite();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      jobTitle: '',
      baseLocation: '',
      role: 'security_analyst',
      team: 'offensive_security',
      accessTier: 'standard',
      accessReviewDue: '',
      scopeNotes: '',
      ndaOnFile: false,
      backgroundVerified: false,
      trainingAcknowledged: false,
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const [nda, background, training] = watch([
    'ndaOnFile',
    'backgroundVerified',
    'trainingAcknowledged',
  ]);
  const outstanding = [nda, background, training].filter((done) => !done).length;
  const sendEnabled = isValid && outstanding === 0;

  const submit = (draft: boolean) =>
    handleSubmit((values) => {
      const body: ProvisionInviteBody = {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        ...(values.jobTitle.trim() !== '' ? { jobTitle: values.jobTitle.trim() } : {}),
        ...(values.baseLocation.trim() !== '' ? { baseLocation: values.baseLocation.trim() } : {}),
        role: values.role,
        team: values.team,
        accessTier: values.accessTier,
        ...(values.accessReviewDue !== '' ? { accessReviewDue: values.accessReviewDue } : {}),
        ...(values.scopeNotes.trim() !== '' ? { scopeNotes: values.scopeNotes.trim() } : {}),
        checklist: {
          mfaEnrolmentMandatory: true,
          ndaOnFile: values.ndaOnFile,
          backgroundVerified: values.backgroundVerified,
          trainingAcknowledged: values.trainingAcknowledged,
        },
        ...(draft ? { draft: true } : {}),
      };
      provision.mutate(body, {
        onSuccess: () => {
          onOpenChange(false);
          if (draft) {
            toast({
              kind: 'ok',
              title: 'Draft saved',
              message: `${body.fullName} — stored privately.`,
            });
          } else {
            toast({
              kind: 'ok',
              title: 'Invitation sent',
              message: `Secure invitation issued to ${body.email}`,
            });
          }
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 409 && error.code === 'email_taken') {
            setError('email', {
              message: 'That email already has an account or invitation.',
            });
            return;
          }
          toast({
            kind: 'crit',
            title: 'Could not send the invitation',
            message: 'Please try again.',
          });
        },
      });
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="um-modal-content">
        <div className="um-modal-head">
          <div>
            <span className="um-modal-eyebrow">
              <UserPlus size={13} aria-hidden="true" />
              Identity, Access & Provisioning
            </span>
            <DialogTitle className="um-modal-title">Provision New Team Member</DialogTitle>
            <DialogDescription className="um-modal-sub">
              Issue a scoped invitation to a security team member — expires in 72 hours.
            </DialogDescription>
          </div>
        </div>

        <form className="um-modal-body" onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="um-form-grid">
            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-name">
                Full Name
              </label>
              <input
                id="um-prov-name"
                className="um-input"
                autoComplete="off"
                {...register('fullName')}
              />
              {errors.fullName ? (
                <span className="um-field-error">{errors.fullName.message}</span>
              ) : null}
            </div>

            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-email">
                Work Email
              </label>
              <input
                id="um-prov-email"
                className="um-input"
                type="email"
                autoComplete="off"
                {...register('email')}
              />
              <span className="um-field-helper">@vunvault.com domain</span>
              {errors.email ? <span className="um-field-error">{errors.email.message}</span> : null}
            </div>

            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-title">
                Job Title
              </label>
              <input
                id="um-prov-title"
                className="um-input"
                autoComplete="off"
                {...register('jobTitle')}
              />
            </div>

            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-location">
                Base / Location
              </label>
              <input
                id="um-prov-location"
                className="um-input"
                autoComplete="off"
                {...register('baseLocation')}
              />
            </div>

            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-role">
                Role
              </label>
              <select id="um-prov-role" className="um-select" {...register('role')}>
                {ROLE_OPTIONS.map((role) => (
                  <option
                    key={role}
                    value={role}
                    disabled={PRIVILEGED_ROLES.has(role) && !isSuperAdmin}
                  >
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-team">
                Team
              </label>
              <select id="um-prov-team" className="um-select" {...register('team')}>
                {TEAM_OPTIONS.map((team) => (
                  <option key={team} value={team}>
                    {TEAM_LABELS[team]}
                  </option>
                ))}
              </select>
            </div>

            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-tier">
                Access tier
              </label>
              <select id="um-prov-tier" className="um-select" {...register('accessTier')}>
                {TIER_OPTIONS.map((tier) => (
                  <option key={tier} value={tier}>
                    {ACCESS_TIER_LABELS[tier]}
                  </option>
                ))}
              </select>
            </div>

            <div className="um-field">
              <label className="um-field-label" htmlFor="um-prov-review">
                Access review due
              </label>
              <input
                id="um-prov-review"
                className="um-input"
                type="date"
                {...register('accessReviewDue')}
              />
            </div>
          </div>

          <div className="um-field">
            <label className="um-field-label" htmlFor="um-prov-scope">
              Scope Notes
            </label>
            <textarea
              id="um-prov-scope"
              className="um-textarea"
              rows={3}
              {...register('scopeNotes')}
            />
            <span className="um-field-helper">Visible to reviewers only</span>
          </div>

          <div>
            <div className="um-modal-section-title">Onboarding Checklist</div>
            <div className="um-ack-list">
              <label className="um-ack-item">
                <input
                  type="checkbox"
                  className="um-ovr"
                  aria-label="MFA enrolment mandatory"
                  checked
                  disabled
                  readOnly
                />
                <span className="um-ack-text">
                  <span className="um-ack-title">MFA enrolment mandatory</span>
                </span>
              </label>
              <label className="um-ack-item">
                <input type="checkbox" className="um-ovr" {...register('ndaOnFile')} />
                <span className="um-ack-text">
                  <span className="um-ack-title">NDA on file</span>
                </span>
              </label>
              <label className="um-ack-item">
                <input type="checkbox" className="um-ovr" {...register('backgroundVerified')} />
                <span className="um-ack-text">
                  <span className="um-ack-title">Background verified</span>
                </span>
              </label>
              <label className="um-ack-item">
                <input type="checkbox" className="um-ovr" {...register('trainingAcknowledged')} />
                <span className="um-ack-text">
                  <span className="um-ack-title">Training acknowledged</span>
                </span>
              </label>
            </div>
          </div>
        </form>

        <div className="um-modal-foot">
          <span className="um-modal-foot-note">
            <span role="status">{outstanding} outstanding security requirement(s) </span>— expires
            in 72 hours.
          </span>
          <div className="um-modal-foot-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              disabled={!isValid || provision.isPending}
              onClick={() => void submit(true)()}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="um-send-invite"
              disabled={!sendEnabled || provision.isPending}
              onClick={() => void submit(false)()}
            >
              <Send size={15} aria-hidden="true" />
              <span>{sendEnabled ? 'Send Secure Invitation' : 'Provisioning incomplete'}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

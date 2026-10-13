'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { SCAN_TYPE_LABELS, type ScanType } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { Dialog, DialogContent, DialogDescription, DialogTitle, toast } from '@vunvault/ui';
import { useAuthorisationUrl, useCreateScan } from '../_hooks/use-scans';
import '../_styles/scans.css';

/**
 * New scan request dialog (Task 69) — the three-step upload choreography the
 * spec pins: `POST /scans/authorisation-url` → `PUT` the PDF to the presigned
 * URL → `POST /scans` with the returned `authorisationDocKey`. The signed
 * authorisation is REQUIRED — without it the platform cannot lawfully touch
 * the target.
 *
 * A successful request toasts the queue confirmation; the new job does NOT
 * appear in the table until the review gate releases it (the toast says so).
 * `422 authorisation_missing` / `422 target_not_allowed` map to the planner's
 * verbatim inline messages.
 */

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const FILE_REQUIRED = 'The signed authorisation PDF is required.';
const FILE_INVALID = 'Choose a PDF up to 10 MB.';
const AUTHORISATION_FAILED = 'The signed authorisation could not be verified. Upload it again.';
const TARGET_NOT_ALLOWED =
  'That target cannot be scanned. Internal and private addresses require an engagement lead.';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
] as const;

const SCAN_TYPE_ORDER = Object.keys(SCAN_TYPE_LABELS) as ScanType[];

const newScanSchema = z.object({
  targetHost: z.string().trim().min(3),
  scanType: z.enum(SCAN_TYPE_ORDER as [ScanType, ...ScanType[]]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  environment: z.enum(['production', 'staging']).optional(),
  scopeNotes: z.string().max(1000).optional(),
});

type NewScanFormValues = z.input<typeof newScanSchema>;

export interface NewScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewScanDialog({ open, onOpenChange }: NewScanDialogProps) {
  const authorisationUrl = useAuthorisationUrl();
  const createScan = useCreateScan();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewScanFormValues>({
    resolver: zodResolver(newScanSchema),
    defaultValues: {
      targetHost: '',
      scanType: 'external',
      priority: 'medium',
      environment: 'production',
      scopeNotes: '',
    },
  });

  const pending = isSubmitting || authorisationUrl.isPending || createScan.isPending;

  const close = () => {
    onOpenChange(false);
    reset();
    setFile(null);
    setFileError('');
    setFormError('');
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    if (file === null) {
      setFileError(FILE_REQUIRED);
      return;
    }
    if (file.type !== 'application/pdf' || file.size > MAX_PDF_BYTES || file.size === 0) {
      setFileError(FILE_INVALID);
      return;
    }
    try {
      // 1 — the presigned PUT target for the signed authorisation.
      const { uploadUrl, objectKey } = await authorisationUrl.mutateAsync({
        contentType: 'application/pdf',
        sizeBytes: file.size,
      });
      // 2 — the file itself, straight to object storage (never via the API).
      const upload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!upload.ok) {
        setFormError(AUTHORISATION_FAILED);
        return;
      }
      // 3 — the scan request referencing the stored document.
      const job = await createScan.mutateAsync({
        targetHost: values.targetHost,
        scanType: values.scanType,
        priority: values.priority,
        ...(values.environment !== undefined ? { environment: values.environment } : {}),
        ...(values.scopeNotes !== undefined && values.scopeNotes !== ''
          ? { scopeNotes: values.scopeNotes }
          : {}),
        authorisationDocKey: objectKey,
      });
      toast({
        kind: 'ok',
        title: 'Scan requested',
        message: `Job ${job.jobCode} is queued. You will be notified when the report is released.`,
      });
      close();
    } catch (submitError) {
      if (isApiError(submitError) && submitError.code === 'authorisation_missing') {
        setFormError(AUTHORISATION_FAILED);
        return;
      }
      if (isApiError(submitError) && submitError.code === 'target_not_allowed') {
        setFormError(TARGET_NOT_ALLOWED);
        return;
      }
      // Authored fallback (the spec pins copy for the two 422s only).
      toast({ kind: 'crit', title: 'Scan request failed', message: 'Please try again.' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="vps-dialog-card" hideClose={false}>
        <span className="vps-eyebrow">New engagement</span>
        <DialogTitle className="mt-3 text-lg font-extrabold tracking-[-0.01em] text-ink">
          New scan request
        </DialogTitle>
        <DialogDescription className="mt-1 text-[0.78rem] leading-relaxed text-ink-muted">
          Only scan systems you own or are authorised in writing to test.
        </DialogDescription>

        <form className="vps-form mt-4" onSubmit={onSubmit} noValidate>
          <div className="vps-field">
            <label htmlFor="vps-target">Target</label>
            <input
              id="vps-target"
              className={cn('vps-input', errors.targetHost !== undefined && 'is-invalid')}
              type="text"
              placeholder="app.example.co.ke"
              autoComplete="off"
              aria-invalid={errors.targetHost !== undefined}
              {...register('targetHost')}
            />
            <span className="vps-error" role="alert">
              {errors.targetHost?.message}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
            <div className="vps-field">
              <label htmlFor="vps-scan-type">Scan type</label>
              <select id="vps-scan-type" className="vps-select" {...register('scanType')}>
                {SCAN_TYPE_ORDER.map((scanType) => (
                  <option key={scanType} value={scanType}>
                    {SCAN_TYPE_LABELS[scanType]}
                  </option>
                ))}
              </select>
            </div>
            <div className="vps-field">
              <label htmlFor="vps-priority">Priority</label>
              <select id="vps-priority" className="vps-select" {...register('priority')}>
                {PRIORITY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="vps-field">
            <label htmlFor="vps-environment">Environment</label>
            <select id="vps-environment" className="vps-select" {...register('environment')}>
              {ENVIRONMENT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="vps-field">
            <label htmlFor="vps-scope-notes">Scope notes</label>
            <textarea
              id="vps-scope-notes"
              className="vps-textarea"
              rows={3}
              {...register('scopeNotes')}
            />
          </div>

          <div className="vps-field vps-file">
            <label htmlFor="vps-authorisation">Signed authorisation (PDF, max 10 MB)</label>
            <input
              id="vps-authorisation"
              type="file"
              accept="application/pdf"
              aria-invalid={fileError !== ''}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setFileError('');
              }}
            />
            {fileError !== '' ? (
              <span className="vps-error" role="alert">
                {fileError}
              </span>
            ) : null}
          </div>

          {formError !== '' ? (
            <p className="vps-error" role="alert" aria-live="polite">
              {formError}
            </p>
          ) : null}

          <div className="vps-modal-actions">
            <p className="vps-dialog-note">
              The signed authorisation is verified before any traffic reaches the target.
            </p>
            <button type="button" className="vps-btn vps-btn--ghost" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              className="vps-btn vps-btn--primary"
              id="vps-scan-submit"
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? (
                <span className="vps-btn-spinner" aria-hidden="true" />
              ) : (
                <Send size={14} aria-hidden="true" />
              )}
              <span>Request scan</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

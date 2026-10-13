'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  FilePlus2,
  Hash,
  Loader2,
  Megaphone,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  ClipboardList,
} from 'lucide-react';
import { z } from 'zod';
import type {
  Advisory,
  AdvisoryDraftBody,
  AdvisoryScopeEntry,
  FindingSeverity,
} from '@vunvault/contracts';
import {
  AdvisoryDraftBody as AdvisoryDraftBodySchema,
  AdvisoryScopeEntry as AdvisoryScopeEntrySchema,
  ADVISORY_STATUS_LABELS,
  ADVISORY_TITLE_MESSAGE,
  CVE_ID_MESSAGE,
  CVE_ID_PATTERN,
  FindingSeveritySchema,
  severityMatchesCvss,
} from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { useSession } from '../../../../../lib/session';
import {
  useLoadDraft,
  useNvdImport,
  useSaveAdvisory,
  useBroadcastEstimate,
} from '../_hooks/use-advisories-admin';
import { useBroadcastProgress, progressOf } from '../_hooks/use-broadcast';
import { useBroadcastStream } from '../_hooks/use-broadcast-stream';
import { SEVERITY_LABELS, parseCvss, severityFromCvss } from '../_lib/cvss';
import { ScopeEntries } from './scope-entries';
import { SeverityPicker } from './severity-picker';
import {
  BroadcastDialog,
  MISSING_PHRASES,
  incompleteMessage,
  type BroadcastTarget,
} from './broadcast-dialog';

/**
 * Advisory Editor + Publish Controls (Task 81).
 *
 * `useAdvisoryEditor` owns the one piece of state the whole desk shares — the
 * RHF form, the id of the advisory being edited (null = create), the saved
 * status and the last-save stamp — so the editor card, the Publish Controls
 * panel and the live client preview all read the same controller. The page
 * creates it once and hands it down.
 *
 * Validation is deliberately two-tier. The form resolver catches what an
 * operator can see going wrong while typing (CVE shape, the three character
 * caps, the scope cap). Everything else is decided by `AdvisoryDraftBody` at
 * submit time, and its Zod issues are mapped back onto fields — so the CVSS
 * range, the date format and the reference URLs are all judged by the contract
 * and the API, never by a second, drift-prone copy of the rules here.
 *
 * Autosave is NOT used (the spec's rule): a draft only reaches the API when
 * Save Draft is pressed.
 */

export interface AdvisoryFormValues {
  cveId: string;
  vendor: string;
  /** Text as typed — `maxlength=4`, `inputmode=decimal`; parsed on submit. */
  cvss: string;
  /** `''` or `YYYY-MM-DD` from the date input. */
  disclosureDate: string;
  severity: FindingSeverity | '';
  weaponized: boolean;
  publicPoc: boolean;
  preAuth: boolean;
  patchAvailable: boolean;
  title: string;
  summary: string;
  remediation: string;
  /** One URL per line, as the reference's textarea holds it. */
  references: string;
  scope: AdvisoryScopeEntry[];
}

const advisoryFormSchema = z.object({
  cveId: z.string().regex(CVE_ID_PATTERN, CVE_ID_MESSAGE),
  vendor: z.string().max(120),
  cvss: z.string().max(4),
  disclosureDate: z.string(),
  severity: FindingSeveritySchema.or(z.literal('')),
  weaponized: z.boolean(),
  publicPoc: z.boolean(),
  preAuth: z.boolean(),
  patchAvailable: z.boolean(),
  title: z.string().max(140),
  summary: z.string().max(1200),
  remediation: z.string().max(900),
  references: z.string(),
  scope: z.array(AdvisoryScopeEntrySchema).max(50),
});

const EMPTY_FORM: AdvisoryFormValues = {
  cveId: '',
  vendor: '',
  cvss: '',
  disclosureDate: '',
  severity: '',
  weaponized: false,
  publicPoc: false,
  preAuth: false,
  patchAvailable: false,
  title: '',
  summary: '',
  remediation: '',
  references: '',
  scope: [],
};

/** The three character caps the counters render, from the contract's maxima. */
const TITLE_LIMIT = 140;
const SUMMARY_LIMIT = 1200;
const REMEDIATION_LIMIT = 900;

/** Short status labels for the Editorial State row (`Draft`, not the tag's full text). */
const STATUS_ROW_LABELS: Record<Advisory['status'], string> = {
  draft: 'Draft',
  published: 'Published',
  retracted: 'Retracted',
};

/** `e.reed@vunvault.com → "e.reed"` — the label form the fixtures use. */
function authorLabelOf(email: string): string {
  return email.split('@')[0] ?? email;
}

function toDraftBody(values: AdvisoryFormValues): unknown {
  const references = values.references
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const cvss = parseCvss(values.cvss);
  return {
    cveId: values.cveId.trim(),
    ...(values.vendor.trim() === '' ? {} : { vendor: values.vendor.trim() }),
    ...(cvss === null ? {} : { cvss }),
    ...(values.disclosureDate === '' ? {} : { disclosureDate: values.disclosureDate }),
    ...(values.severity === '' ? {} : { severity: values.severity }),
    weaponized: values.weaponized,
    publicPoc: values.publicPoc,
    preAuth: values.preAuth,
    patchAvailable: values.patchAvailable,
    ...(values.title.trim() === '' ? {} : { title: values.title.trim() }),
    ...(values.summary.trim() === '' ? {} : { summary: values.summary.trim() }),
    ...(values.remediation.trim() === '' ? {} : { remediation: values.remediation.trim() }),
    references,
    scope: values.scope,
  };
}

function fromAdvisory(advisory: Advisory): AdvisoryFormValues {
  return {
    cveId: advisory.cveId,
    vendor: advisory.vendor ?? '',
    cvss: advisory.cvss === null ? '' : advisory.cvss.toFixed(1),
    disclosureDate: advisory.disclosureDate ?? '',
    severity: advisory.severity ?? '',
    weaponized: advisory.weaponized,
    publicPoc: advisory.publicPoc,
    preAuth: advisory.preAuth,
    patchAvailable: advisory.patchAvailable,
    title: advisory.title ?? '',
    summary: advisory.summary ?? '',
    remediation: advisory.remediation ?? '',
    references: advisory.references.join('\n'),
    scope: advisory.scope.map((entry) => ({ ...entry })),
  };
}

export interface AdvisoryEditorController {
  form: ReturnType<typeof useForm<AdvisoryFormValues>>;
  /** Live values — the preview and the Editorial State panel both watch these. */
  values: AdvisoryFormValues;
  advisoryId: string | null;
  status: Advisory['status'];
  lastSavedAt: string | null;
  authorLabel: string;
  isSaving: boolean;
  isImporting: boolean;
  /** A manual severity that disagrees with the CVSS band. */
  severityMismatch: boolean;
  saveDraft(): void;
  clearEditor(): void;
  importFromNvd(): void;
  loadAdvisory(advisory: Advisory): void;
  loadDraftById(id: string): void;
  /** Records that a human — not the CVSS projection — chose the severity. */
  markSeverityManual(): void;
  /** The advisory the Task 82 dialog is confirming, or null when closed. */
  broadcastTarget: BroadcastTarget | null;
  /** Runs the pre-checks, then opens the dialog in `initial` mode. */
  requestBroadcast(): void;
  /** Opens the same dialog for a published advisory (`Re-broadcast advisory`). */
  requestRebroadcast(advisory: Advisory): void;
  closeBroadcast(): void;
  /** Set once a dispatch succeeded — starts the 3 s delivery poll. */
  progressId: string | null;
  markDispatched(id: string): void;
}

export function useAdvisoryEditor(): AdvisoryEditorController {
  const { user } = useSession();
  const form = useForm<AdvisoryFormValues>({
    resolver: zodResolver(advisoryFormSchema),
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const values = form.watch();

  const [advisoryId, setAdvisoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<Advisory['status']>('draft');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  /** Set once the operator picks a severity by hand; stops CVSS auto-select. */
  const [severityManual, setSeverityManual] = useState(false);

  const save = useSaveAdvisory();
  const nvd = useNvdImport();
  const loadDraft = useLoadDraft();

  const cvssValue = parseCvss(values.cvss);
  const severityMismatch =
    cvssValue !== null &&
    values.severity !== '' &&
    !severityMatchesCvss(values.severity, cvssValue);

  // CVSS drives the severity until the operator overrides it. Writing through
  // `setValue` (not `reset`) keeps the rest of the draft — and its dirty state
  // — intact, and `shouldDirty` is left off so autosave is never implied.
  const previousCvss = useRef<string>(values.cvss);
  useEffect(() => {
    if (previousCvss.current === values.cvss) return;
    previousCvss.current = values.cvss;
    if (severityManual) return;
    const parsed = parseCvss(values.cvss);
    const projected = parsed === null ? '' : severityFromCvss(parsed);
    form.setValue('severity', projected ?? '');
  }, [values.cvss, severityManual, form]);

  const clearEditor = useCallback((): void => {
    form.reset(EMPTY_FORM);
    setAdvisoryId(null);
    setStatus('draft');
    setLastSavedAt(null);
    setSeverityManual(false);
    previousCvss.current = '';
    toast({ kind: 'info', title: 'Editor cleared', message: 'Ready for a new zero-day advisory.' });
  }, [form]);

  const loadAdvisory = useCallback(
    (advisory: Advisory): void => {
      form.reset(fromAdvisory(advisory));
      setAdvisoryId(advisory.id);
      setStatus(advisory.status);
      setLastSavedAt(advisory.lastSavedAt);
      setSeverityManual(advisory.severity !== null);
      previousCvss.current = advisory.cvss === null ? '' : advisory.cvss.toFixed(1);
    },
    [form],
  );

  const loadDraftById = useCallback(
    (id: string): void => {
      loadDraft.mutate(id, {
        onSuccess: (advisory) => {
          if (advisory === null) {
            toast({
              kind: 'warn',
              title: 'Draft unavailable',
              message: 'That draft is no longer on the desk.',
            });
            return;
          }
          loadAdvisory(advisory);
        },
        onError: () =>
          toast({
            kind: 'crit',
            title: 'Draft unavailable',
            message: 'That draft is no longer on the desk.',
          }),
      });
    },
    [loadDraft, loadAdvisory],
  );

  const saveDraft = useCallback((): void => {
    // An empty CVE is "nothing to save", not a validation failure: the spec
    // asks for the toast rather than a red field.
    if (values.cveId.trim() === '') {
      toast({
        kind: 'warn',
        title: 'Nothing to save',
        message: 'Add at least a CVE identifier before saving this advisory as a draft.',
      });
      return;
    }
    void form.handleSubmit((submitted) => {
      const parsed = AdvisoryDraftBodySchema.safeParse(toDraftBody(submitted));
      if (!parsed.success) {
        // The contract's own messages, mapped back onto the offending field.
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field !== 'string') continue;
          form.setError(field as keyof AdvisoryFormValues, { message: issue.message });
        }
        toast({
          kind: 'warn',
          title: 'Advisory incomplete',
          message: 'Some fields need your attention before this draft can be saved.',
        });
        return;
      }
      const body = parsed.data as AdvisoryDraftBody;
      save.mutate(
        { id: advisoryId, body },
        {
          onSuccess: (response) => {
            const saved = response.data;
            setAdvisoryId(saved.id);
            setStatus(saved.status);
            setLastSavedAt(saved.lastSavedAt);
            toast({
              kind: 'ok',
              title: 'Draft saved',
              message: `${saved.cveId} stored privately. Only the intelligence team can see it until broadcast.`,
            });
          },
          onError: (error) => {
            if (isApiError(error) && error.status === 409 && error.code === 'cve_exists') {
              form.setError('cveId', {
                message: 'An advisory for this CVE already exists.',
              });
              return;
            }
            toast({
              kind: 'crit',
              title: 'Could not save draft',
              message: isApiError(error) ? error.message : 'Please try again.',
            });
          },
        },
      );
    })();
  }, [values.cveId, form, save, advisoryId]);

  const importFromNvd = useCallback((): void => {
    void form.trigger('cveId').then((valid) => {
      if (!valid) return;
      const cveId = form.getValues('cveId').trim();
      nvd.mutate(cveId, {
        onSuccess: (result) => {
          // Pre-fill only — the spec is explicit that an import never saves.
          form.setValue('vendor', result.vendor ?? '');
          form.setValue('cvss', result.cvss === null ? '' : result.cvss.toFixed(1));
          form.setValue('severity', result.severity ?? '');
          form.setValue('disclosureDate', result.disclosureDate ?? '');
          form.setValue('title', result.title ?? '');
          form.setValue('summary', result.summary ?? '');
          form.setValue('references', result.references.join('\n'));
          setSeverityManual(result.severity !== null);
          previousCvss.current = result.cvss === null ? '' : result.cvss.toFixed(1);
          toast({
            kind: 'ok',
            title: 'NVD data imported',
            message: 'Review the imported fields before saving.',
          });
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 404) {
            form.setError('cveId', { message: 'CVE not found in NVD.' });
            return;
          }
          toast({
            kind: 'warn',
            title: 'Import From NVD',
            message: 'NVD is unavailable. Enter the details manually.',
          });
        },
      });
    });
  }, [form, nvd]);

  const markSeverityManual = useCallback((): void => {
    setSeverityManual(true);
  }, []);

  const [broadcastTarget, setBroadcastTarget] = useState<BroadcastTarget | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);

  /**
   * The pre-checks that run BEFORE the dialog opens (Task 82): the advisory
   * must already be saved — the endpoint is per-advisory — and must carry the
   * four things a broadcast cannot go out without. The missing items are
   * listed in the spec's own order and joined into the verbatim sentence.
   */
  const requestBroadcast = useCallback((): void => {
    const current = form.getValues();
    const missing: string[] = [];
    if (!CVE_ID_PATTERN.test(current.cveId.trim())) missing.push(MISSING_PHRASES.cve);
    if (current.title.trim() === '') missing.push(MISSING_PHRASES.title);
    if (current.severity === '') missing.push(MISSING_PHRASES.severity);
    if (current.scope.length === 0) missing.push(MISSING_PHRASES.scope);

    if (missing.length > 0) {
      toast({
        kind: 'warn',
        title: 'Advisory incomplete',
        message: incompleteMessage(missing),
      });
      return;
    }
    if (advisoryId === null) {
      // The endpoint is per-advisory, so a never-saved draft cannot be
      // dispatched. AUTHORED copy: the spec names the four missing-item
      // phrases but gives no line for "complete yet unsaved".
      toast({
        kind: 'warn',
        title: 'Advisory incomplete',
        message: 'Save the advisory as a draft before raising an emergency broadcast.',
      });
      return;
    }
    setBroadcastTarget({
      id: advisoryId,
      cveId: current.cveId.trim(),
      title: current.title.trim() === '' ? null : current.title.trim(),
      severity: current.severity === '' ? null : current.severity,
      scope: current.scope,
      mode: 'initial',
    });
  }, [form, advisoryId]);

  const requestRebroadcast = useCallback((advisory: Advisory): void => {
    setBroadcastTarget({
      id: advisory.id,
      cveId: advisory.cveId,
      title: advisory.title,
      severity: advisory.severity,
      scope: advisory.scope,
      mode: 'rebroadcast',
    });
  }, []);

  const closeBroadcast = useCallback((): void => {
    setBroadcastTarget(null);
  }, []);

  return {
    form,
    values,
    advisoryId,
    status,
    lastSavedAt,
    authorLabel: user === null ? '—' : authorLabelOf(user.email),
    isSaving: save.isPending,
    isImporting: nvd.isPending,
    severityMismatch,
    saveDraft,
    clearEditor,
    importFromNvd,
    loadAdvisory,
    loadDraftById,
    markSeverityManual,
    broadcastTarget,
    requestBroadcast,
    requestRebroadcast,
    closeBroadcast,
    progressId,
    markDispatched: setProgressId,
  };
}

function Counter({ length, limit }: { length: number; limit: number }) {
  return (
    <span className={cn('zd-counter', length >= limit ? 'is-full' : undefined)}>
      {length} / {limit}
    </span>
  );
}

export interface AdvisoryEditorProps {
  controller: AdvisoryEditorController;
}

export function AdvisoryEditor({ controller }: AdvisoryEditorProps) {
  const { form, values, status, severityMismatch } = controller;
  const {
    register,
    formState: { errors },
  } = form;

  const cveError = errors.cveId?.message;

  return (
    <section className="adm-card" aria-labelledby="zd-editor-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="zd-editor-heading">
            <ShieldAlert size={15} aria-hidden="true" />
            Advisory Editor
          </h2>
          <p className="adm-card-note">
            Complete the CVE details, set the severity level and define the affected scope. Drafts
            are private to the intelligence team until explicitly broadcast.
          </p>
        </div>
        <span className="adm-tag" id="zd-draft-tag">
          {ADVISORY_STATUS_LABELS[status]}
        </span>
      </div>
      <div className="adm-card-body">
        <form className="zd-form" id="zd-form" noValidate>
          <fieldset className="zd-fieldset">
            <legend className="zd-legend">
              <Hash size={12} aria-hidden="true" />
              Identifiers
            </legend>
            <div className="zd-row">
              <div className="zd-field">
                <label className="zd-label" htmlFor="zd-cve">
                  <span>
                    CVE ID
                    <span className="zd-label-req" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <span className="zd-hint">Format: CVE-YYYY-NNNNN</span>
                </label>
                <input
                  id="zd-cve"
                  className={cn(
                    'zd-input zd-mono',
                    cveError === undefined ? undefined : 'is-invalid',
                  )}
                  type="text"
                  placeholder="CVE-2026-21447"
                  autoComplete="off"
                  required
                  aria-describedby="zd-cve-error"
                  aria-invalid={cveError === undefined ? undefined : true}
                  {...register('cveId')}
                />
                <span className="zd-hint" id="zd-cve-error" hidden={cveError === undefined}>
                  {cveError ?? CVE_ID_MESSAGE}
                </span>
              </div>
              <div className="zd-field">
                <label className="zd-label" htmlFor="zd-vendor">
                  <span>Vendor / Project</span>
                </label>
                <input
                  id="zd-vendor"
                  className="zd-input"
                  type="text"
                  placeholder="Apache Software Foundation"
                  autoComplete="off"
                  {...register('vendor')}
                />
              </div>
            </div>
            <div className="zd-row">
              <div className="zd-field">
                <label className="zd-label" htmlFor="zd-cvss">
                  <span>CVSS v3.1 Base Score</span>
                  <span className="zd-hint">0.0 – 10.0</span>
                </label>
                <input
                  id="zd-cvss"
                  className={cn(
                    'zd-input zd-mono',
                    errors.cvss === undefined ? undefined : 'is-invalid',
                  )}
                  type="text"
                  placeholder="9.8"
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={4}
                  aria-invalid={errors.cvss === undefined ? undefined : true}
                  {...register('cvss')}
                />
                {errors.cvss === undefined ? null : (
                  <span className="zd-error">{errors.cvss.message}</span>
                )}
              </div>
              <div className="zd-field">
                <label className="zd-label" htmlFor="zd-published">
                  <span>Disclosure Date (UTC)</span>
                </label>
                <input
                  id="zd-published"
                  className="zd-input zd-mono"
                  type="date"
                  {...register('disclosureDate')}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="zd-fieldset">
            <legend className="zd-legend">
              <SlidersHorizontal size={12} aria-hidden="true" />
              Severity Level
            </legend>
            <SeverityPicker
              name="zd-severity"
              value={values.severity}
              mismatch={severityMismatch}
              error={errors.severity?.message}
              onChange={(severity) => {
                controller.markSeverityManual();
                form.setValue('severity', severity, { shouldValidate: true });
              }}
            />
            <div className="zd-flags">
              <label className="zd-flag" htmlFor="zd-weaponized">
                <input id="zd-weaponized" type="checkbox" {...register('weaponized')} />
                Weaponized in the wild
              </label>
              <label className="zd-flag" htmlFor="zd-poc">
                <input id="zd-poc" type="checkbox" {...register('publicPoc')} />
                Public PoC available
              </label>
              <label className="zd-flag" htmlFor="zd-preauth">
                <input id="zd-preauth" type="checkbox" {...register('preAuth')} />
                Pre-auth exploitable
              </label>
              <label className="zd-flag" htmlFor="zd-patch">
                <input id="zd-patch" type="checkbox" {...register('patchAvailable')} />
                Vendor patch available
              </label>
            </div>
          </fieldset>

          <fieldset className="zd-fieldset">
            <legend className="zd-legend">
              <FilePlus2 size={12} aria-hidden="true" />
              Advisory Title
            </legend>
            <div className="zd-field">
              <div className="zd-label-row">
                <label className="zd-label" htmlFor="zd-title">
                  <span>
                    Headline
                    <span className="zd-label-req" aria-hidden="true">
                      *
                    </span>
                  </span>
                </label>
                <Counter length={values.title.length} limit={TITLE_LIMIT} />
              </div>
              <input
                id="zd-title"
                className={cn('zd-input', errors.title === undefined ? undefined : 'is-invalid')}
                type="text"
                autoComplete="off"
                maxLength={TITLE_LIMIT}
                aria-invalid={errors.title === undefined ? undefined : true}
                {...register('title')}
              />
              <span className="zd-hint">{ADVISORY_TITLE_MESSAGE}</span>
              <p className="zd-pattern">
                Use the pattern: <strong>Product — impact in plain language</strong>. Avoid exploit
                detail in the headline.
              </p>
            </div>
          </fieldset>

          <fieldset className="zd-fieldset">
            <legend className="zd-legend">
              <ClipboardList size={12} aria-hidden="true" />
              Affected Scope
            </legend>
            <ScopeEntries
              entries={values.scope}
              invalid={errors.scope !== undefined}
              onChange={(scope) => form.setValue('scope', scope, { shouldValidate: true })}
            />
          </fieldset>

          <fieldset className="zd-fieldset">
            <legend className="zd-legend">
              <Megaphone size={12} aria-hidden="true" />
              Technical Summary &amp; Guidance
            </legend>
            <div className="zd-field">
              <div className="zd-label-row">
                <label className="zd-label" htmlFor="zd-summary">
                  <span>Technical Summary</span>
                </label>
                <Counter length={values.summary.length} limit={SUMMARY_LIMIT} />
              </div>
              <textarea
                id="zd-summary"
                className={cn(
                  'zd-textarea',
                  errors.summary === undefined ? undefined : 'is-invalid',
                )}
                rows={5}
                maxLength={SUMMARY_LIMIT}
                {...register('summary')}
              />
            </div>
            <div className="zd-field">
              <div className="zd-label-row">
                <label className="zd-label" htmlFor="zd-remediation">
                  <span>Remediation Guidance</span>
                </label>
                <Counter length={values.remediation.length} limit={REMEDIATION_LIMIT} />
              </div>
              <textarea
                id="zd-remediation"
                className={cn(
                  'zd-textarea',
                  errors.remediation === undefined ? undefined : 'is-invalid',
                )}
                rows={4}
                maxLength={REMEDIATION_LIMIT}
                {...register('remediation')}
              />
            </div>
            <div className="zd-field">
              <div className="zd-label-row">
                <label className="zd-label" htmlFor="zd-references">
                  <span>References</span>
                </label>
                <span className="zd-hint">One URL per line</span>
              </div>
              <textarea
                id="zd-references"
                className={cn(
                  'zd-textarea zd-mono',
                  errors.references === undefined ? undefined : 'is-invalid',
                )}
                rows={3}
                {...register('references')}
              />
              {errors.references === undefined ? null : (
                <span className="zd-error">{errors.references.message}</span>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}

export interface PublishControlsProps {
  controller: AdvisoryEditorController;
  /** `intel:write` — without it the desk is read-only. */
  canWrite: boolean;
  /** `intel:broadcast` — gates the Emergency Broadcast area. */
  canBroadcast: boolean;
  onPreviewClientView(): void;
}

export function PublishControls({
  controller,
  canWrite,
  canBroadcast,
  onPreviewClientView,
}: PublishControlsProps) {
  const { values, status, lastSavedAt, authorLabel, isSaving } = controller;
  const estimate = useBroadcastEstimate(controller.advisoryId);
  // The stream is the transport while a broadcast is in flight; the 3 s poll
  // only runs when there is no `EventSource` or the relay closed the socket.
  // The socket is held only while there is an UNSETTLED record to watch:
  // the first fetch resolves before the stream opens (so its snapshot cannot
  // race the initial paint), and the socket closes in the very render the
  // delivery settles — a finished broadcast has nothing left to say, and the
  // relay's cap is 5 streams per person.
  const inFlight = controller.progressId !== null;
  const [isStreamLive, setIsStreamLive] = useState(false);
  const progress = useBroadcastProgress(controller.progressId, inFlight, isStreamLive);
  const progressView = progressOf(progress.data);
  const streamStatus = useBroadcastStream(
    controller.progressId,
    inFlight && progress.data !== undefined && !(progressView?.settled ?? true),
  );
  useEffect(() => {
    setIsStreamLive(streamStatus !== 'offline');
  }, [streamStatus]);

  return (
    <section className="adm-card adm-card--dark">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <Megaphone size={15} aria-hidden="true" />
            Publish Controls
          </h2>
          <p className="adm-card-note">
            Save the advisory as a private draft, or raise an emergency broadcast to every affected
            client dashboard.
          </p>
        </div>
      </div>
      <div className="adm-card-body zd-panel">
        <div className="zd-panel-section">
          <span className="zd-panel-title">
            <ClipboardList size={12} aria-hidden="true" />
            Editorial State
          </span>
          <div className="zd-status-row">
            <span>Current status</span>
            <strong id="zd-status-value">{STATUS_ROW_LABELS[status]}</strong>
          </div>
          <div className="zd-status-row">
            <span>Last saved</span>
            <strong id="zd-last-saved">
              {lastSavedAt === null ? 'Never' : new Date(lastSavedAt).toISOString()}
            </strong>
          </div>
          <div className="zd-status-row">
            <span>Severity set</span>
            <strong id="zd-severity-value">
              {values.severity === '' ? 'Not set' : SEVERITY_LABELS[values.severity]}
            </strong>
          </div>
          <div className="zd-status-row">
            <span>Scope entries</span>
            <strong id="zd-scope-count">{values.scope.length}</strong>
          </div>
          <div className="zd-status-row">
            <span>Author</span>
            <strong>{authorLabel}</strong>
          </div>
        </div>

        <div className="zd-panel-section">
          <span className="zd-panel-title">
            <Save size={12} aria-hidden="true" />
            Actions
          </span>
          <div className="zd-actions-stack">
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="zd-save-draft"
              disabled={!canWrite || isSaving}
              onClick={controller.saveDraft}
            >
              <Save size={15} aria-hidden="true" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="zd-preview-client"
              onClick={onPreviewClientView}
            >
              <Eye size={15} aria-hidden="true" />
              <span>Preview Client View</span>
            </button>
            {canBroadcast ? (
              <button
                type="button"
                className="adm-btn adm-btn-danger"
                id="zd-emergency-broadcast"
                onClick={controller.requestBroadcast}
              >
                <Megaphone size={15} aria-hidden="true" />
                <span>Emergency Broadcast</span>
              </button>
            ) : null}
          </div>
          {progressView === null || progressView.settled ? null : (
            <p className="zd-progress" role="status">
              <Loader2 size={13} aria-hidden="true" className="animate-spin" />
              <span>
                Delivering… {progressView.sent}/{progressView.audience}
              </span>
              {isStreamLive ? <span className="zd-live-dot" aria-hidden="true" /> : null}
            </p>
          )}
          {progressView !== null && progressView.settled && progressView.failed ? (
            <p className="zd-progress zd-progress--failed" role="alert">
              <span>
                Delivery failed at {progressView.sent}/{progressView.audience} dashboards.
              </span>
            </p>
          ) : null}
          <p className="zd-action-note">
            Broadcasts are irreversible once dispatched. Verify the severity and scope before
            confirming.
          </p>
        </div>

        {canBroadcast ? (
          <div className="zd-panel-section">
            <p className="zd-action-note">
              <strong>Emergency broadcast</strong> pushes the advisory to every matching client
              dashboard, issues email and SMS alerts to registered contacts, and opens a SEV-1 audit
              event.
            </p>
          </div>
        ) : null}

        {canBroadcast ? (
          <div className="zd-panel-section">
            <span className="zd-panel-title">
              <Megaphone size={12} aria-hidden="true" />
              Estimated Broadcast Reach
            </span>
            <div className="zd-reach">
              <div className="zd-reach-row">
                <span>Client dashboards</span>
                <strong>{estimate.data?.dashboards ?? '—'}</strong>
              </div>
              <div className="zd-reach-row">
                <span>Email contacts</span>
                <strong>{estimate.data?.emailContacts ?? '—'}</strong>
              </div>
              <div className="zd-reach-row">
                <span>SMS / on-call</span>
                <strong>{estimate.data?.smsContacts ?? '—'}</strong>
              </div>
              <div className="zd-reach-row">
                <span>Incident commander</span>
                <strong>{estimate.data?.incidentCommanders ?? '—'}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* One dialog serves both doors: the Emergency Broadcast button above and
          the published table's Re-broadcast (which sets `mode` accordingly). */}
      {canBroadcast ? (
        <BroadcastDialog
          target={controller.broadcastTarget}
          onOpenChange={(next) => {
            if (!next) controller.closeBroadcast();
          }}
          onDispatched={controller.markDispatched}
        />
      ) : null}
    </section>
  );
}

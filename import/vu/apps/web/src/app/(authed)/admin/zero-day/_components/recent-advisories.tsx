'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';
import type { Advisory } from '@vunvault/contracts';
import { SCOPE_CATEGORY_LABELS } from '@vunvault/contracts';
import { cn, formatDayMonth, isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Skeleton,
  toast,
} from '@vunvault/ui';
import {
  RECENT_PUBLISHED_LIMIT,
  useAdvisorySummary,
  usePublishedAdvisories,
  useRetractAdvisory,
} from '../_hooks/use-advisories-admin';
import { SEVERITY_LABELS } from '../_lib/cvss';
import { PatchStatusMenu } from './patch-status-menu';

/**
 * Recently Published Advisories — the last six advisories pushed to
 * client dashboards, with broadcast reach and remediation state.
 *
 * Rows come from `GET /admin/advisories?status=published`; the head tag counts
 * every published advisory (`AdvisorySummary.advisoriesPublished`), which is
 * why the reference shows `418 Published` above six rows.
 *
 * Three row actions, each permission-gated:
 * - `Edit` refills the editor and switches the form to `PUT`.
 * - `Re-broadcast` is the an earlier iteration seam — the button renders here, the dialog
 * it opens arrives with the broadcast task (`intel:broadcast` only).
 * - `Retract` (`intel:broadcast` only) opens a confirm dialog whose note is
 * required and at least 10 characters, matching `RetractBody`, before it
 * posts `…/retract`.
 *
 * The `Status` cell is the inline patch-status menu (`intel:write`).
 */

/** `2026-09-24T14:36:00Z → "24 Sep · 14:36"` (UTC) — the reference's stamp. */
function formatBroadcastStamp(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${formatDayMonth(date)} · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** `Web & API · Struts 2.0.0 – 2.5.32` — category label, then the entry. */
function scopeLine(advisory: Advisory): string {
  return advisory.scope
    .map((entry) =>
      entry.category === null
        ? entry.label
        : `${SCOPE_CATEGORY_LABELS[entry.category]} · ${entry.label}`,
    )
    .join(', ');
}

/** The RetractBody floor (`note.min(10)`), enforced before the request. */
const RETRACT_NOTE_MINIMUM = 10;

const RETRACT_NOTE_MESSAGE = `Add a note of at least ${RETRACT_NOTE_MINIMUM} characters.`;

export interface RecentAdvisoriesProps {
  /** `intel:write` — enables the inline patch-status menu. */
  canWrite: boolean;
  /** `intel:broadcast` — shows Re-broadcast and Retract. */
  canBroadcast: boolean;
  onEdit(advisory: Advisory): void;
  /** an earlier iteration wires this to the broadcast dialog in rebroadcast mode. */
  onRebroadcast(advisory: Advisory): void;
}

export function RecentAdvisories({
  canWrite,
  canBroadcast,
  onEdit,
  onRebroadcast,
}: RecentAdvisoriesProps) {
  const list = usePublishedAdvisories();
  const summary = useAdvisorySummary();
  const retract = useRetractAdvisory();
  const [retractTarget, setRetractTarget] = useState<Advisory | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');

  const rows = (list.data ?? []).slice(0, RECENT_PUBLISHED_LIMIT);
  const publishedTotal = summary.data?.advisoriesPublished ?? rows.length;

  const closeRetract = (): void => {
    setRetractTarget(null);
    setNote('');
    setNoteError('');
  };

  const submitRetract = (): void => {
    if (retractTarget === null) return;
    const trimmed = note.trim();
    if (trimmed.length < RETRACT_NOTE_MINIMUM) {
      setNoteError(RETRACT_NOTE_MESSAGE);
      return;
    }
    const advisory = retractTarget;
    retract.mutate(
      { id: advisory.id, note: trimmed },
      {
        onSuccess: () => {
          closeRetract();
          toast({
            kind: 'ok',
            title: 'Advisory retracted',
            message: `${advisory.cveId} was withdrawn from client dashboards.`,
          });
        },
        onError: (error) => {
          closeRetract();
          toast({
            kind: 'crit',
            title: 'Could not retract advisory',
            message: isApiError(error) ? error.message : 'Please try again.',
          });
        },
      },
    );
  };

  return (
    <section className="adm-card" aria-labelledby="zd-published-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="zd-published-heading">
            <Radio size={15} aria-hidden="true" />
            Recently Published Advisories
          </h2>
          <p className="adm-card-note">
            Last six advisories pushed to client dashboards, with broadcast reach and remediation
            state.
          </p>
        </div>
        <span className="adm-tag adm-tag--ok">{publishedTotal} Published</span>
      </div>

      {list.isLoading ? (
        <div className="adm-card-body" aria-busy="true">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="adm-card-body">
          <EmptyState
            title="Nothing published yet"
            description="Advisories appear here once they are broadcast to client dashboards."
          />
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table zd-table">
            <caption className="sr-only">Recently published zero-day advisories</caption>
            <thead>
              <tr>
                <th scope="col">CVE ID</th>
                <th scope="col">Advisory Title</th>
                <th scope="col">Severity</th>
                <th scope="col">Broadcast</th>
                <th scope="col" className="adm-num">
                  Reach
                </th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((advisory) => (
                <tr key={advisory.id}>
                  <td className="adm-mono">{advisory.cveId}</td>
                  <td>
                    <span className="zd-advisory-title">
                      {advisory.title === null ? '—' : advisory.title}
                    </span>
                    <span className="zd-advisory-scope">{scopeLine(advisory)}</span>
                  </td>
                  <td>
                    <span
                      className={cn(
                        'zd-sev-pill',
                        advisory.severity === null
                          ? 'zd-sev-pill--none'
                          : `zd-sev-pill--${advisory.severity}`,
                      )}
                    >
                      {advisory.severity === null ? '—' : SEVERITY_LABELS[advisory.severity]}
                    </span>
                  </td>
                  <td className="adm-mono">
                    {advisory.lastBroadcastAt === null || advisory.publishedAt === null
                      ? '—'
                      : formatBroadcastStamp(advisory.lastBroadcastAt ?? advisory.publishedAt)}
                  </td>
                  <td className="adm-num adm-strong">
                    {advisory.reach === null ? '—' : `${advisory.reach} dashboards`}
                  </td>
                  <td>
                    <PatchStatusMenu advisory={advisory} canWrite={canWrite} />
                  </td>
                  <td>
                    <div className="zd-row-actions">
                      <button
                        type="button"
                        className="zd-act"
                        disabled={!canWrite}
                        onClick={() => onEdit(advisory)}
                      >
                        Edit
                      </button>
                      {canBroadcast ? (
                        <>
                          <button
                            type="button"
                            className="zd-act"
                            onClick={() => onRebroadcast(advisory)}
                          >
                            Re-broadcast
                          </button>
                          <button
                            type="button"
                            className="zd-act zd-act--danger"
                            onClick={() => setRetractTarget(advisory)}
                          >
                            Retract
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>
                  Broadcast reach counts unique client dashboards that acknowledged the advisory
                  within 24 hours.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog
        open={retractTarget !== null}
        onOpenChange={(next) => {
          if (!next) closeRetract();
        }}
      >
        <DialogContent size="sm">
          <DialogTitle>Retract advisory</DialogTitle>
          <DialogDescription>
            {retractTarget === null
              ? ''
              : `${retractTarget.cveId} will be withdrawn from every client dashboard. Clients keep the retraction note on their record.`}
          </DialogDescription>
          <div className="zd-field">
            <label className="zd-label" htmlFor="zd-retract-note">
              <span>
                Retraction note
                <span className="zd-label-req" aria-hidden="true">
                  *
                </span>
              </span>
            </label>
            <textarea
              id="zd-retract-note"
              className={cn('zd-textarea', noteError === '' ? undefined : 'is-invalid')}
              rows={3}
              value={note}
              aria-invalid={noteError === '' ? undefined : true}
              aria-describedby={noteError === '' ? undefined : 'zd-retract-note-error'}
              onChange={(event) => {
                setNote(event.target.value);
                if (noteError !== '') setNoteError('');
              }}
            />
            {noteError === '' ? null : (
              <span className="zd-error" id="zd-retract-note-error">
                {noteError}
              </span>
            )}
          </div>
          <div className="zd-actions-stack">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              disabled={retract.isPending}
              onClick={submitRetract}
            >
              Retract advisory
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

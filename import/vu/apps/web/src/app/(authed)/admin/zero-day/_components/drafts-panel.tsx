'use client';

import { FileEdit } from 'lucide-react';
import { formatRelativeActive } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { useAdvisorySummary, useDraftList } from '../_hooks/use-advisories-admin';

/**
 * Open Drafts panel — the intelligence team's work in progress.
 * Rows come from `GET /admin/advisories/drafts` and carry exactly what the
 * contract's `DraftListItem` supplies: the CVE, the title, the author and the
 * API-computed `note` chip (`Unsaved changes` / `Awaiting reviewer` /
 * `Needs scope entries`).
 *
 * DEVIATION (documented): the reference markup also shows a severity pill in
 * each row's top-right slot. `DraftListItem` has no severity field and this
 * task may not widen the contract, so the pill is omitted rather than faked —
 * the spec's own row description lists only CVE, title, author and note.
 *
 * The head tag and the `View all <n> drafts` button count EVERY open draft
 * (`AdvisorySummary.openDrafts`), while the panel itself lists the most recent
 * few the endpoint returns — the same total/list split the reference shows
 * (tag `7`, three rows).
 *
 * Clicking a row hands the id to the page, which re-reads the full draft and
 * refills the editor (`PUT` thereafter). The reference marks the row up as an
 * `<article tabindex="0">`; because the whole card is the control, it is a
 * `div[role="button"]` here — the `featured-image.tsx` precedent — which keeps
 * Enter/Space activation and a visible focus ring without putting an
 * interactive role on a non-interactive semantic element.
 */

export interface DraftsPanelProps {
  onSelectDraft(id: string): void;
}

export function DraftsPanel({ onSelectDraft }: DraftsPanelProps) {
  const drafts = useDraftList();
  const summary = useAdvisorySummary();

  const rows = drafts.data ?? [];
  const total = summary.data?.openDrafts ?? rows.length;

  const activate = (id: string): void => {
    onSelectDraft(id);
  };

  return (
    <section className="adm-card" aria-labelledby="zd-drafts-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="zd-drafts-heading">
            <FileEdit size={15} aria-hidden="true" />
            Open Drafts
          </h2>
          <p className="adm-card-note">Work in progress, private to the intelligence team.</p>
        </div>
        <span className="adm-tag adm-tag--warn">{total}</span>
      </div>
      <div className="adm-card-body">
        {drafts.isLoading ? (
          <div className="zd-drafts" aria-busy="true">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No open drafts"
            description="Everything the intelligence team has written is published."
          />
        ) : (
          <div className="zd-drafts">
            {rows.map((draft) => (
              <div
                key={draft.id}
                className="zd-draft"
                role="button"
                tabIndex={0}
                aria-label={`Open draft ${draft.cveId}`}
                onClick={() => activate(draft.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  activate(draft.id);
                }}
              >
                <div className="zd-draft-top">
                  <span className="zd-draft-cve">{draft.cveId}</span>
                </div>
                <span className="zd-draft-title">
                  {draft.title === null ? 'Untitled draft' : draft.title}
                </span>
                <div className="zd-draft-meta">
                  <span>
                    {draft.authorLabel} ·{' '}
                    {formatRelativeActive(new Date(draft.lastSavedAt), new Date())}
                  </span>
                  {draft.note === null ? null : <span>{draft.note}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div>
          <button type="button" className="adm-mini-btn" id="zd-view-all-drafts">
            View all {total} drafts
          </button>
        </div>
      </div>
    </section>
  );
}

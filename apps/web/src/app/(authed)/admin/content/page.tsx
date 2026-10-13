'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  CheckCheck,
  Download,
  FileStack,
  Layers,
  PieChart,
  PlayCircle,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { ContentReviewAction, ModerationItem } from '@vunvault/contracts';
import { CONTENT_TYPE_LABELS } from '@vunvault/contracts';
import { formatUtcClock } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { can } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { AdminPageHead } from '../_components/admin-page-head';
import { ContentSummary } from './_components/content-summary';
import { ContentTable } from './_components/content-table';
import { ContentToolbar, type ContentToolbarValues } from './_components/content-toolbar';
import { ReviewDialog } from './_components/review-dialog';
import { reportError } from './_components/row-actions';
import {
  MODERATION_PAGE_SIZE,
  bulkApproveTargets,
  useModerationAction,
  useModerationQueue,
  useModerationSummary,
  useQueueSnapshot,
  type ModerationFilters,
} from './_hooks/use-moderation';
import './_styles/content.css';

/**
 * `/admin/content` (Task 83) — Pre-Publication Review Queue: the summary tiles,
 * the URL-driven filter toolbar, the queue table with its risk flags and
 * status-driven row actions, the editorial review dialog, and the aside's
 * workflow / distribution / guidelines / activity panels.
 *
 * Client page inside a Suspense boundary: it reads `useSearchParams` (the
 * Task 77/79 precedent), so every filtered view is linkable and the browser
 * Back button works.
 *
 * Permission: `content:moderate` gates every write. Without it the queue is
 * readable but every action is disabled — the API remains the authority.
 */

/** The five guidelines, verbatim from the reference card. */
const GUIDELINES = [
  {
    num: '01',
    title: 'No unverified claims',
    text: 'Every technical assertion must trace to a cited source or internal test evidence.',
  },
  {
    num: '02',
    title: 'No client or personal data',
    text: 'Screenshots, logs and case studies must be fully anonymised before publication.',
  },
  {
    num: '03',
    title: 'Legal review completed where flagged',
    text: 'Named entities, government bodies and vendor attribution require legal sign-off.',
  },
  {
    num: '04',
    title: 'Brand voice consistent',
    text: 'Tone, terminology and product naming must match the VUNVAULT editorial standard.',
  },
  {
    num: '05',
    title: 'Publication path selected',
    text: 'Decide whether the item publishes immediately, on schedule, or requires a client-only release.',
  },
] as const;

function paramOrEmpty(searchParams: URLSearchParams, key: string): string {
  return searchParams.get(key) ?? '';
}

export default function AdminContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentView />
    </Suspense>
  );
}

function ContentView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const canModerate = can(user, 'content:moderate');

  const filters: ModerationFilters = {
    q: paramOrEmpty(searchParams, 'q'),
    type: paramOrEmpty(searchParams, 'type') as ModerationFilters['type'],
    status: paramOrEmpty(searchParams, 'status') as ModerationFilters['status'],
    flag: paramOrEmpty(searchParams, 'flag') as ModerationFilters['flag'],
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: MODERATION_PAGE_SIZE,
  };

  const queue = useModerationQueue(filters);
  const summary = useModerationSummary();
  const { snapshot } = useQueueSnapshot();
  const action = useModerationAction();

  const [reviewItem, setReviewItem] = useState<ModerationItem | null>(null);
  const [reviewPreset, setReviewPreset] = useState<ContentReviewAction | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const items = useMemo(() => queue.data?.data ?? [], [queue.data]);
  const total = queue.data?.total ?? 0;
  const updateParams = (patch: Partial<ContentToolbarValues>): void => {
    const params = new URLSearchParams();
    const merged: ContentToolbarValues = {
      q: filters.q,
      type: filters.type,
      status: filters.status,
      flag: filters.flag,
      ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== '') params.set(key, value);
    }
    const qs = params.toString();
    // A filter change always returns to page 1 — the old page may not exist.
    router.replace(qs === '' ? '/admin/content' : `/admin/content?${qs}`);
  };

  const resetFilters = (): void => {
    router.replace('/admin/content');
    toast({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full pre-publication review queue.',
    });
  };

  const openReview = (item: ModerationItem, preset: ContentReviewAction | null): void => {
    setReviewItem(item);
    setReviewPreset(preset);
  };

  const reviewNext = (): void => {
    const next = items.find((item) => item.status === 'pending_review');
    if (next === undefined) {
      toast({
        kind: 'info',
        title: 'Queue clear',
        message: 'No items are currently pending review.',
      });
      return;
    }
    openReview(next, null);
  };

  const refreshQueue = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['content'] }).then(() =>
      toast({
        kind: 'ok',
        title: 'Queue refreshed',
        message: `Synced at ${formatUtcClock(new Date())}.`,
      }),
    );
  };

  /**
   * `Approve All Flag-Free` — the spec's bulk rule: iterate the approve action
   * over every flag-free pending item the caller did NOT author, handling each
   * result individually (one 409 must not abort the rest).
   */
  const bulkApprove = async (): Promise<void> => {
    const targets = bulkApproveTargets(items, user?.id ?? null);
    if (targets.length === 0) {
      toast({
        kind: 'warn',
        title: 'Nothing to approve',
        message: 'No flag-free pending items are currently in the queue.',
      });
      return;
    }
    setBulkRunning(true);
    let approved = 0;
    for (const target of targets) {
      try {
        await action.mutateAsync({ id: target.id, action: 'approve' });
        approved += 1;
      } catch (error) {
        reportError(error);
      }
    }
    setBulkRunning(false);
    if (approved > 0) {
      toast({
        kind: 'ok',
        title: 'Bulk approval complete',
        message: `${approved} of ${targets.length} flag-free items cleared for publication.`,
      });
    }
  };

  const typeRows = (Object.keys(CONTENT_TYPE_LABELS) as (keyof typeof CONTENT_TYPE_LABELS)[]).map(
    (type) => ({ type, count: snapshot.pendingByType[type] }),
  );

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Pre-Publication Review Queue"
        title="Content Moderation"
        description="Every blog post, news announcement, threat advisory and product listing authored by staff must clear editorial review before it renders live on the public website."
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="cm-review-next"
              disabled={!canModerate}
              onClick={reviewNext}
            >
              <PlayCircle size={15} aria-hidden="true" />
              <span>Review Next Item</span>
            </button>
            {/* No export endpoint exists (plan decision #5): disabled + tooltip. */}
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              id="cm-export-queue"
              disabled
              title="Export is not available yet."
            >
              <Download size={15} aria-hidden="true" />
              <span>Export Review Log</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="cm-refresh-queue"
              onClick={refreshQueue}
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>Refresh Queue</span>
            </button>
          </>
        }
      />

      <section aria-labelledby="cm-kpi-heading">
        <h2 id="cm-kpi-heading" className="sr-only">
          Content moderation indicators
        </h2>
        <ContentSummary />
      </section>

      <div className="cm-layout">
        <div className="cm-col">
          <ContentToolbar
            values={{
              q: filters.q,
              type: filters.type,
              status: filters.status,
              flag: filters.flag,
            }}
            shown={items.length}
            total={total}
            onChange={updateParams}
            onReset={resetFilters}
          />
          <ContentTable
            items={items}
            total={total}
            isLoading={queue.isLoading}
            awaitingReview={summary.data?.awaitingReview ?? null}
            canModerate={canModerate}
            onReview={openReview}
            onResetFilters={resetFilters}
          />
        </div>

        <aside className="cm-col" aria-label="Moderation controls">
          <section className="adm-card adm-card--dark">
            <div className="adm-card-head">
              <div>
                <h2 className="adm-card-title">
                  <Layers size={15} aria-hidden="true" />
                  Review Workflow
                </h2>
                <p className="adm-card-note">
                  Every item must clear editorial review before it can be published to the public
                  website.
                </p>
              </div>
            </div>
            <div className="adm-card-body cm-panel">
              <div className="cm-panel-section">
                <span className="cm-panel-title">
                  <FileStack size={12} aria-hidden="true" />
                  Queue Snapshot
                </span>
                <div className="cm-status-row">
                  <span>Pending review</span>
                  <strong>{summary.data?.awaitingReview ?? '—'}</strong>
                </div>
                <div className="cm-status-row">
                  <span>In review</span>
                  <strong>{snapshot.inReview}</strong>
                </div>
                <div className="cm-status-row">
                  <span>Changes requested</span>
                  <strong>{summary.data?.changesRequested ?? '—'}</strong>
                </div>
                <div className="cm-status-row">
                  <span>Approved (not yet live)</span>
                  <strong>{summary.data?.approvedToday ?? '—'}</strong>
                </div>
                <div className="cm-status-row">
                  <span>Oldest waiting item</span>
                  <strong>
                    {snapshot.oldestWaitingHours === null
                      ? '—'
                      : `${snapshot.oldestWaitingHours} h`}
                  </strong>
                </div>
              </div>

              <div className="cm-panel-section">
                <span className="cm-panel-title">
                  <CheckCheck size={12} aria-hidden="true" />
                  Bulk Actions
                </span>
                <div className="cm-actions-stack">
                  <button
                    type="button"
                    className="adm-btn adm-btn-ghost"
                    id="cm-bulk-approve"
                    disabled={!canModerate || bulkRunning}
                    onClick={() => void bulkApprove()}
                  >
                    <CheckCheck size={15} aria-hidden="true" />
                    <span>Approve All Flag-Free</span>
                  </button>
                  {/* No escalate / remind-all endpoints exist yet; both are the
                      prototype's seams (the Task 79 `um-export-roster` precedent). */}
                  <button type="button" className="adm-btn adm-btn-dark" id="cm-bulk-escalate">
                    <TriangleAlert size={15} aria-hidden="true" />
                    <span>Escalate Flagged Items</span>
                  </button>
                  <button type="button" className="adm-btn adm-btn-ghost" id="cm-bulk-remind">
                    <CheckCheck size={15} aria-hidden="true" />
                    <span>Remind All Authors</span>
                  </button>
                </div>
                <p className="cm-action-note">
                  Bulk approvals still require individual confirmation per item.
                </p>
              </div>
            </div>
          </section>

          <section className="adm-card adm-card--dark" aria-labelledby="cm-dist-heading">
            <div className="adm-card-head">
              <div>
                <h2 className="adm-card-title" id="cm-dist-heading">
                  <PieChart size={15} aria-hidden="true" />
                  Queue by Content Type
                </h2>
                <p className="adm-card-note">
                  Breakdown of the {snapshot.pendingTotal} items currently awaiting review.
                </p>
              </div>
              <span className="adm-tag">{snapshot.pendingTotal} Items</span>
            </div>
            <div className="adm-card-body">
              <div className="cm-dist">
                {typeRows.map(({ type, count }) => (
                  <div className="cm-dist-row" key={type}>
                    <span className="cm-dist-name">{CONTENT_TYPE_LABELS[type]}</span>
                    <progress
                      className="cm-progress"
                      value={count}
                      max={Math.max(1, snapshot.pendingTotal)}
                    >
                      {count}
                    </progress>
                    <span className="cm-dist-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="adm-card" aria-labelledby="cm-guidelines-heading">
            <div className="adm-card-head">
              <div>
                <h2 className="adm-card-title" id="cm-guidelines-heading">
                  <BookOpen size={15} aria-hidden="true" />
                  Pre-Publication Guidelines
                </h2>
                <p className="adm-card-note">
                  The five checks every reviewer must complete before approving content.
                </p>
              </div>
            </div>
            <div className="adm-card-body">
              <div className="cm-guidelines">
                {GUIDELINES.map((guideline) => (
                  <div className="cm-guideline" key={guideline.num}>
                    <span className="cm-guideline-num">{guideline.num}</span>
                    <span className="cm-guideline-body">
                      <span className="cm-guideline-title">{guideline.title}</span>
                      <span className="cm-guideline-text">{guideline.text}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="adm-card adm-card--dark" aria-labelledby="cm-activity-heading">
            <div className="adm-card-head">
              <div>
                <h2 className="adm-card-title" id="cm-activity-heading">
                  <Layers size={15} aria-hidden="true" />
                  Recent Moderation Activity
                </h2>
                <p className="adm-card-note">Last six editorial decisions across the queue.</p>
              </div>
              <span className="adm-tag">Live</span>
            </div>
            <div className="adm-card-body">
              {/* TODO(backend-contract): no moderation-activity endpoint exists —
                  the feed stays empty rather than inventing decisions. */}
              <p className="cm-activity-empty">No editorial decisions recorded yet.</p>
            </div>
          </section>
        </aside>
      </div>

      <ReviewDialog
        item={reviewItem}
        preset={reviewPreset}
        open={reviewItem !== null}
        onOpenChange={(next) => {
          if (!next) setReviewItem(null);
        }}
      />
    </div>
  );
}

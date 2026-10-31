'use client';

import { FileText, Megaphone, Newspaper, Package, SearchX } from 'lucide-react';
import type { ContentType, ModerationItem } from '@vunvault/contracts';
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS, TEAM_LABELS } from '@vunvault/contracts';
import { cn, formatQueueStamp } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { RiskFlags } from './risk-flags';
import { RowActions } from './row-actions';

/**
 * Pending Publication Queue table .
 *
 * Seven columns exactly as the reference: the content cell (thumbnail, title,
 * summary, slug path), the type chip from `CONTENT_TYPE_LABELS`, the author
 * (initials + name + team from `TEAM_LABELS`), the submission stamp
 * (`formatQueueStamp` → `DD Mon · HH:MM UTC`), the risk-flag chips, the status
 * from `CONTENT_STATUS_LABELS` and the status-driven row actions.
 *
 * The empty state is the reference's own `cm-empty` block, and its
 * `Reset Filters` button calls back into the page's URL reset so the toolbar
 * and the table cannot disagree about what is filtered.
 */

/** Type → thumbnail icon and tone modifier. */
const TYPE_THUMB: Record<ContentType, { icon: typeof FileText; modifier: string }> = {
  blog_post: { icon: FileText, modifier: 'cm-thumb--blog' },
  news_announcement: { icon: Newspaper, modifier: 'cm-thumb--news' },
  threat_advisory: { icon: Megaphone, modifier: 'cm-thumb--advisory' },
  product_listing: { icon: Package, modifier: 'cm-thumb--product' },
};

/** Status → the `adm-badge` tone. */
const STATUS_TONE: Record<ModerationItem['status'], string> = {
  draft: 'adm-badge--info',
  pending_review: 'adm-badge--warn',
  in_review: 'adm-badge--info',
  changes_requested: 'adm-badge--warn',
  approved: 'adm-badge--ok',
  rejected: 'adm-badge--crit',
  scheduled: 'adm-badge--pending',
  published: 'adm-badge--settled',
};

export interface ContentTableProps {
  items: readonly ModerationItem[];
  total: number;
  isLoading: boolean;
  awaitingReview: number | null;
  canModerate: boolean;
  onReview(item: ModerationItem, preset: 'approve' | null): void;
  onResetFilters(): void;
}

export function ContentTable({
  items,
  total,
  isLoading,
  awaitingReview,
  canModerate,
  onReview,
  onResetFilters,
}: ContentTableProps) {
  return (
    <section className="adm-card" aria-labelledby="cm-queue-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="cm-queue-heading">
            <SearchX size={15} aria-hidden="true" />
            Pending Publication Queue
          </h2>
          <p className="adm-card-note">
            Content authored by staff members awaiting editorial sign-off before it renders on the
            public website. Nothing here is visible to clients or the public yet.
          </p>
        </div>
        <span className="adm-tag adm-tag--warn">
          {awaitingReview === null ? '—' : awaitingReview} Awaiting Review
        </span>
      </div>

      {isLoading ? (
        <div className="adm-card-body" aria-busy="true">
          <Skeleton className="h-72 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="cm-empty is-visible" id="cm-empty">
          <span className="cm-empty-icon" aria-hidden="true">
            <SearchX size={22} />
          </span>
          <span className="cm-empty-title">No content matches the current filters</span>
          <span className="cm-empty-text">
            Adjust your search terms or reset the filters to see the full pre-publication review
            queue.
          </span>
          <button
            type="button"
            className="adm-btn adm-btn-ghost"
            id="cm-empty-reset"
            onClick={onResetFilters}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table cm-table">
            <caption className="sr-only">
              Content awaiting pre-publication review with type, author, risk flags and moderation
              actions
            </caption>
            <thead>
              <tr>
                <th scope="col">Content</th>
                <th scope="col">Type</th>
                <th scope="col">Author</th>
                <th scope="col">Submitted</th>
                <th scope="col">Risk Flags</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody id="cm-tbody">
              {items.map((item) => {
                const thumb = TYPE_THUMB[item.type];
                const ThumbIcon = thumb.icon;
                return (
                  <tr className="cm-row" key={item.id}>
                    <td>
                      <div className="cm-content-cell">
                        <span className={cn('cm-thumb', thumb.modifier)} aria-hidden="true">
                          <ThumbIcon size={22} />
                        </span>
                        <span className="cm-content-body">
                          <span className="cm-title">{item.title}</span>
                          {item.summary === null ? null : (
                            <span className="cm-excerpt">{item.summary}</span>
                          )}
                          <span className="cm-slug">{item.slugPath}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="cm-type-chip">{CONTENT_TYPE_LABELS[item.type]}</span>
                    </td>
                    <td>
                      <div className="cm-author">
                        <span className="cm-author-initials" aria-hidden="true">
                          {item.author.initials}
                        </span>
                        <span className="cm-author-body">
                          <span className="cm-author-name">{item.author.fullName}</span>
                          <span className="cm-author-team">
                            {item.author.team === null ? '—' : TEAM_LABELS[item.author.team]}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="adm-mono">{formatQueueStamp(new Date(item.submittedAt))}</td>
                    <td>
                      <RiskFlags flags={item.riskFlags} />
                    </td>
                    <td>
                      <span className={cn('adm-badge', STATUS_TONE[item.status])}>
                        {CONTENT_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td>
                      <RowActions
                        item={item}
                        canModerate={canModerate}
                        onReview={(preset) =>
                          onReview(item, preset === 'approve' ? 'approve' : null)
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>
                  Content approved here is queued for publication, not immediately visible. Use the
                  content editor to schedule a live time.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {total > items.length ? (
        <div className="adm-card-body">
          <EmptyState
            title="More items match this filter"
            description={`${total} items in total — refine the filters to narrow the queue.`}
          />
        </div>
      ) : null}
    </section>
  );
}

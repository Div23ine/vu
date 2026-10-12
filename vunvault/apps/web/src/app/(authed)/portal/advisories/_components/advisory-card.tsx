'use client';

import { Check, ExternalLink } from 'lucide-react';
import type { ClientAdvisory } from '@vunvault/contracts';
import { PATCH_STATUS_LABELS, SCOPE_CATEGORY_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  Skeleton,
  toast,
  type BadgeTone,
} from '@vunvault/ui';
import { sortAdvisories, useAcknowledgeAdvisory, useAdvisories } from '../_hooks/use-advisories';
import '../_styles/advisories.css';

/**
 * Advisory card + feed (Task 70) — one `ClientAdvisory` per card: severity
 * `Badge`, monospace CVE id, title, the fixed `VUNVAULT Intelligence` source
 * line, the publication stamp, scope chips, `Summary` and `Recommended
 * remediation` paragraphs, external reference links, the patch-status chip
 * and the Acknowledge action (optimistic; becomes a disabled `Acknowledged`
 * with a check icon). Unacknowledged critical advisories are pinned to the
 * top of the feed with a `critical` left border.
 *
 * The feed also lives here (the deliverables list no separate list file):
 * it owns the 60 s visible-tab poll through `useAdvisories`, the loading
 * skeletons and the empty state.
 */

const SEVERITY_LABELS: Record<ClientAdvisory['severity'], string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

const SEVERITY_TONES: Record<ClientAdvisory['severity'], BadgeTone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

/** Patch status → the semantic chip family (danger / warn / ok). */
const PATCH_CHIP_CLASS: Record<ClientAdvisory['patchStatus'], string> = {
  unpatched: 'vad-status--danger',
  patch_in_progress: 'vad-status--warn',
  patched: 'vad-status--ok',
};

const MONTHS = [
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
] as const;

/** `DD Mon YYYY, HH:MM UTC` — the card's publication stamp (UTC, zero-padded). */
function formatAdvisoryStamp(iso: string): string {
  const date = new Date(iso);
  const month = MONTHS[date.getUTCMonth()] ?? '';
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getUTCDate())} ${month} ${date.getUTCFullYear()}, ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())} UTC`;
}

export function AdvisoryCard({ advisory }: { advisory: ClientAdvisory }) {
  const acknowledge = useAcknowledgeAdvisory();
  const pinned = advisory.severity === 'critical' && !advisory.acknowledged;

  return (
    <Card className={cn('vad-card', pinned ? 'vad-card--pinned' : undefined)}>
      <CardHead className="vad-head">
        <div className="vad-head-left">
          <Badge tone={SEVERITY_TONES[advisory.severity]}>
            {SEVERITY_LABELS[advisory.severity]}
          </Badge>
          <span className="vad-cve">{advisory.cveId}</span>
        </div>
        <span className={cn('vad-status', PATCH_CHIP_CLASS[advisory.patchStatus])}>
          <span className="vad-status-dot" aria-hidden="true" />
          {PATCH_STATUS_LABELS[advisory.patchStatus]}
        </span>
      </CardHead>
      <CardBody>
        <h2 className="vad-title">{advisory.title}</h2>
        <p className="vad-meta">
          <span>{advisory.source}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={advisory.publishedAt}>{formatAdvisoryStamp(advisory.publishedAt)}</time>
        </p>

        <ul className="vad-scopes" aria-label="Affected scope">
          {advisory.scope.map((entry) => (
            <li key={`${entry.label}:${entry.category ?? 'none'}`} className="vad-scope">
              {entry.category === null
                ? entry.label
                : `${entry.label} · ${SCOPE_CATEGORY_LABELS[entry.category]}`}
            </li>
          ))}
        </ul>

        <div className="vad-block-label">Summary</div>
        <p className="vad-text">{advisory.summary}</p>

        <div className="vad-block-label">Recommended remediation</div>
        <p className="vad-text">{advisory.remediation}</p>

        {advisory.references.length > 0 ? (
          <ul className="vad-refs">
            {advisory.references.map((reference) => (
              <li key={reference}>
                <a className="vad-ref" href={reference} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} aria-hidden="true" />
                  {reference}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="vad-actions">
          {advisory.acknowledged ? (
            <Button variant="ghost" size="sm" disabled>
              <Check size={14} aria-hidden="true" />
              Acknowledged
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              loading={acknowledge.isPending}
              onClick={() =>
                acknowledge.mutate(advisory.id, {
                  onError: () =>
                    toast({
                      kind: 'crit',
                      title: 'Could not acknowledge',
                      message: 'Please try again.',
                    }),
                })
              }
            >
              Acknowledge
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function AdvisoriesFeed() {
  const feed = useAdvisories();

  if (feed.isLoading) {
    return (
      <div className="vad-stack" aria-busy="true">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (feed.isError) {
    return (
      <Card className="vad-card">
        <CardBody>
          <p className="text-sm text-ink-muted">The advisories could not be loaded.</p>
        </CardBody>
      </Card>
    );
  }

  const items = sortAdvisories(feed.data ?? []);

  if (items.length === 0) {
    return (
      <Card className="vad-card">
        <CardBody>
          <EmptyState
            title="No active advisories"
            description="We will notify you here and by email when a new zero-day affects your environment."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="vad-stack">
      {items.map((advisory) => (
        <AdvisoryCard key={advisory.id} advisory={advisory} />
      ))}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2, Pause, Play, SearchX, ShieldCheck, Terminal } from 'lucide-react';
import type { AuditEntryView, ChainStatus } from '@vunvault/contracts';
import { AUDIT_CATEGORY_LABELS } from '@vunvault/contracts';
import { cn, formatUtcClock } from '@vunvault/lib';
import { Skeleton } from '@vunvault/ui';
import { STREAM_STATUS_LABELS, type AuditStreamStatus } from '../_hooks/use-audit-stream';
import { SeverityChip } from './severity-chip';

/**
 * Audit trail console — the terminal-styled tail of the chain.
 *
 * The chrome is the reference's (`vunvault-audit-trail@…— tail -f`, the Live
 * and Chain Intact pills, the node/encryption/head-hash/last-sync meta strip);
 * the body is a real `<table>` carrying the seven columns the spec names —
 * `Timestamp (UTC)` as `YYYY-MM-DD HH:MM:SS`, `Category` from
 * `AUDIT_CATEGORY_LABELS`, `Event`, the severity chip with its `SEV-n` suffix,
 * `Actor`, `Details` and the first eight characters of the `Hash`.
 *
 * READ-ONLY BY CONSTRUCTION: the only control in a row is the labelled detail
 * button. There is no edit, delete or redact affordance anywhere on this page,
 * because the chain is append-only and the API exposes no such route.
 *
 * New rows are highlighted for two seconds after an arrival — a poll in the
 * offline fallback, an SSE push since an earlier iteration. The highlight is a background
 * transition only, and `audit.css` disables it under `prefers-reduced-motion`,
 * so the row never moves. The `Live` pill and the pause control report the
 * real stream state (`use-audit-stream`), never a decoration.
 */

/** `2026-09-24T09:41:12Z → "2026-09-24 09:41:12"` — the header already says UTC. */
function formatEntryStamp(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/** How long a freshly arrived row stays highlighted. */
const NEW_ROW_MS = 2_000;

export interface AuditTableProps {
  entries: readonly AuditEntryView[];
  total: number;
  isLoading: boolean;
  chain: ChainStatus | null;
  /** Set when a verification found mismatches — the persistent banner. */
  mismatchSeq: number | null;
  /** The real SSE state — the pill is not a decoration. */
  streamStatus: AuditStreamStatus;
  /** Entries held back while paused — the resume button's `<n> new` count. */
  pausedCount: number;
  onTogglePause(): void;
  onOpenEntry(entry: AuditEntryView): void;
  onResetFilters(): void;
}

export function AuditTable({
  entries,
  total,
  isLoading,
  chain,
  mismatchSeq,
  streamStatus,
  pausedCount,
  onTogglePause,
  onOpenEntry,
  onResetFilters,
}: AuditTableProps) {
  const seen = useRef<ReadonlySet<number>>(new Set());
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Diff each delivery against what has already been seen; anything new is
  // highlighted, then the highlight is dropped after two seconds.
  useEffect(() => {
    const arrived = entries.filter((entry) => !seen.current.has(entry.seq)).map((e) => e.seq);
    seen.current = new Set([...seen.current, ...entries.map((entry) => entry.seq)]);
    if (entries.length > 0) setLastSync(new Date());
    if (arrived.length === 0) return;
    setFresh(new Set(arrived));
    const timer = setTimeout(() => setFresh(new Set()), NEW_ROW_MS);
    return () => clearTimeout(timer);
  }, [entries]);

  const chainIntact = chain?.state !== 'broken';

  return (
    <section className="al-console" aria-labelledby="al-console-heading">
      <div className="al-console-chrome">
        <div className="al-chrome-left">
          <span className="al-dots" aria-hidden="true">
            <span className="al-dot al-dot--close" />
            <span className="al-dot al-dot--min" />
            <span className="al-dot al-dot--max" />
          </span>
          <span className="al-chrome-title" id="al-console-heading">
            <Terminal size={13} aria-hidden="true" />
            vunvault-audit-trail@{chain?.node ?? 'node'}:/var/log/vunvault/audit.log — tail -f
          </span>
        </div>
        <div className="al-chrome-right">
          <span
            className={cn('al-chrome-pill al-chrome-pill--live', `is-${streamStatus}`)}
            id="al-stream-pill"
            role="status"
          >
            <span className="al-live-dot" aria-hidden="true" />
            <span>{STREAM_STATUS_LABELS[streamStatus]}</span>
          </span>
          <button
            type="button"
            className="al-pause-btn"
            id="al-pause-stream"
            onClick={onTogglePause}
            disabled={streamStatus === 'offline'}
            title={
              streamStatus === 'offline'
                ? 'The live stream is unavailable; the tail is polling.'
                : undefined
            }
          >
            {streamStatus === 'paused' ? (
              <Play size={12} aria-hidden="true" />
            ) : (
              <Pause size={12} aria-hidden="true" />
            )}
            <span>{streamStatus === 'paused' ? 'Resume stream' : 'Pause stream'}</span>
            {streamStatus === 'paused' && pausedCount > 0 ? (
              <span className="al-pause-count">{pausedCount} new</span>
            ) : null}
          </button>
          <span
            className={cn('al-chrome-pill al-chrome-pill--chain', { 'is-warn': !chainIntact })}
            id="al-chain-pill"
          >
            <ShieldCheck size={12} aria-hidden="true" />
            <span>{chainIntact ? 'Chain Intact' : 'Chain Broken'}</span>
          </span>
        </div>
      </div>

      <div className="al-console-meta">
        <div className="al-meta-cell">
          <span className="al-meta-label">Node</span>
          <span className="al-meta-value">{chain?.node ?? '—'}</span>
        </div>
        <div className="al-meta-cell">
          <span className="al-meta-label">Encryption</span>
          <span className="al-meta-value">{chain?.encryption ?? '—'}</span>
        </div>
        <div className="al-meta-cell">
          <span className="al-meta-label">Head Hash</span>
          <span className="al-meta-value">{chain?.headHash ?? '—'}</span>
        </div>
        <div className="al-meta-cell">
          <span className="al-meta-label">Last Sync</span>
          <span className="al-meta-value">
            {lastSync === null ? '--:--:-- UTC' : formatUtcClock(lastSync)}
          </span>
        </div>
      </div>

      {mismatchSeq === null ? null : (
        <div className="al-banner" role="alert">
          <Link2 size={14} aria-hidden="true" />
          <span>
            Hash chain mismatch detected at entry #{mismatchSeq}. Escalate to the incident
            commander.
          </span>
        </div>
      )}

      <div
        className="al-console-body"
        id="al-console-body"
        role="log"
        aria-live="polite"
        aria-label="Audit trail stream"
      >
        {isLoading ? (
          <div aria-busy="true" className="al-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="al-empty is-visible" id="al-empty">
            <span className="al-empty-icon" aria-hidden="true">
              <SearchX size={22} />
            </span>
            <span className="al-empty-title">No audit events match the current filters</span>
            <span className="al-empty-text">
              Adjust your search terms or reset the filters to see the full cryptographic audit
              trail.
            </span>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="al-empty-reset"
              onClick={onResetFilters}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="al-table-wrap">
            <table className="adm-table al-table">
              <caption className="sr-only">
                Append-only cryptographic audit trail, newest entry first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Timestamp (UTC)</th>
                  <th scope="col">Category</th>
                  <th scope="col">Event</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Details</th>
                  <th scope="col">Hash</th>
                  <th scope="col">
                    <span className="sr-only">Entry detail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn('al-row', `al-row--${entry.severity}`, {
                      'al-row--new': fresh.has(entry.seq),
                    })}
                  >
                    <td className="al-ts">
                      <strong>{formatEntryStamp(entry.createdAt)}</strong>
                    </td>
                    <td>
                      <span className={cn('al-type', `al-type--${entry.category}`)}>
                        {AUDIT_CATEGORY_LABELS[entry.category]}
                      </span>
                    </td>
                    <td className="al-event">{entry.eventType}</td>
                    <td>
                      <SeverityChip severity={entry.severity} sevLevel={entry.sevLevel} />
                    </td>
                    <td>
                      <span className="al-actor">{entry.actorLabel}</span>
                    </td>
                    <td className="al-msg">{entry.message}</td>
                    <td className="al-hash">{entry.hash.slice(0, 8)}</td>
                    <td>
                      <button
                        type="button"
                        className="al-open"
                        aria-label={`Open detail for audit event ${entry.seq}`}
                        onClick={() => onOpenEntry(entry)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8}>
                    {total} entries match the current filter. Audit entries are append-only and
                    cannot be edited or deleted.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

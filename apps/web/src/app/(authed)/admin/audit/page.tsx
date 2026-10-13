'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, Download, PieChart, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuditCategory, AuditEntryView } from '@vunvault/contracts';
import { AUDIT_RANGE_LABELS } from '@vunvault/contracts';
import { formatUtcClock, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { can } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { AdminPageHead } from '../_components/admin-page-head';
import { AuditSummary } from './_components/audit-summary';
import { AuditTable } from './_components/audit-table';
import { AuditToolbar, type AuditToolbarValues } from './_components/audit-toolbar';
import { ChainPanel } from './_components/chain-panel';
import { EventDialog } from './_components/event-dialog';
import { useAuditStream } from './_hooks/use-audit-stream';
import {
  AUDIT_PAGE_SIZE,
  DEFAULT_RANGE,
  entryMatchesFilters,
  exportAuditCsv,
  isTrailUnfiltered,
  mergeLiveEntries,
  useAuditSummary,
  useAuditTrail,
  useChainStatus,
  useVerifyChain,
  type AuditFilters,
} from './_hooks/use-audit';
import './_styles/audit.css';

/**
 * `/admin/audit` (Task 83b) — the Cryptographic System Audit Trail: the summary
 * tiles, the URL-driven filter bar, the live-style console table, the
 * hash-chain panel and the read-only event detail dialog.
 *
 * READ-ONLY BY DESIGN. The chain is append-only and the API exposes no create,
 * update, delete or redact route, so this page offers none: the only write is
 * `POST …/verify`, which records a checkpoint, and the only download is the
 * signed compliance CSV. Every row control opens a dialog.
 *
 * Client page inside a Suspense boundary: it reads `useSearchParams` (the
 * Task 77/79 precedent), so every filtered view is linkable.
 *
 * Permission: `audit:read`. Since Task 93 the tail is live: page 1 subscribes
 * to `GET …/admin/audit/stream` over SSE, the chrome's `LIVE` pill reports the
 * real connection state, arriving rows are inserted at the head (filtered
 * client-side, because the stream itself is unfiltered) and the reviewer can
 * pause the ticker without losing entries. The 10 s poll survives only as the
 * fallback for a browser without `EventSource` or a stream the server closed.
 */

/** Category → the distribution panel's row label (the reference's own words). */
const DISTRIBUTION_LABELS: Record<AuditCategory, string> = {
  authentication: 'Authentication',
  scan_completion: 'Scan Events',
  report_release: 'Report Releases',
  administrative: 'Administrative',
  security_event: 'Security Events',
  system: 'System',
};

const countFormatter = new Intl.NumberFormat('en-US');

/** How many pushed entries the page remembers between fetches. */
const LIVE_MEMORY_LIMIT = 200;

function paramOrEmpty(searchParams: URLSearchParams, key: string): string {
  return searchParams.get(key) ?? '';
}

export default function AdminAuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditView />
    </Suspense>
  );
}

function AuditView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const canRead = can(user, 'audit:read');

  const rangeParam = paramOrEmpty(searchParams, 'range');
  // Memoised on the URL: the live-merge below depends on `filters`, and a new
  // object every render would recompute the merge on every keystroke of state.
  const filters: AuditFilters = useMemo(
    () => ({
      q: paramOrEmpty(searchParams, 'q'),
      category: paramOrEmpty(searchParams, 'category') as AuditFilters['category'],
      severity: paramOrEmpty(searchParams, 'severity') as AuditFilters['severity'],
      actor: paramOrEmpty(searchParams, 'actor'),
      range: rangeParam === '' ? DEFAULT_RANGE : (rangeParam as AuditFilters['range']),
      page: Number(searchParams.get('page') ?? '1'),
      pageSize: AUDIT_PAGE_SIZE,
    }),
    [searchParams, rangeParam],
  );

  const chain = useChainStatus();
  const summary = useAuditSummary();
  const verify = useVerifyChain();

  const [entry, setEntry] = useState<AuditEntryView | null>(null);
  const [mismatchSeq, setMismatchSeq] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  /** Entries pushed over SSE that the fetched page does not have yet. */
  const [live, setLive] = useState<readonly AuditEntryView[]>([]);

  const stream = useAuditStream({
    enabled: canRead,
    onEntry: (arrived) => {
      // Capped at the server's replay limit: beyond that a refetch is the
      // honest way to catch up, and the tab must not grow without bound.
      setLive((previous) =>
        [arrived, ...previous.filter((e) => e.seq !== arrived.seq)].slice(0, LIVE_MEMORY_LIMIT),
      );
    },
  });

  // The stream is the transport whenever a socket is up or being retried; the
  // poll only runs in the `offline` fallback.
  const trail = useAuditTrail(filters, stream.status !== 'offline');

  const fetched = useMemo(() => trail.data?.data ?? [], [trail.data]);
  const fetchedTotal = trail.data?.total ?? 0;

  // Live rows join the head page only: a reviewer on page 3 is reading history
  // and must not have it shift under them. The push stream carries every
  // entry, so each arrival is matched against the filters on screen.
  const { entries, total } = useMemo(() => {
    if (filters.page !== 1) return { entries: fetched, total: fetchedTotal };
    const matching = live.filter((item) => entryMatchesFilters(item, filters));
    // Only rows the server page does not already contain move the footer:
    // a `Last-Event-ID` replay can push entries the refetch has caught.
    const onScreen = new Set(fetched.map((item) => item.seq));
    const arrived = matching.filter((item) => !onScreen.has(item.seq)).length;
    const unfiltered = isTrailUnfiltered(filters);
    return {
      entries: mergeLiveEntries(fetched, matching, filters.pageSize),
      // The footer's count only moves when nothing is filtered: with a filter
      // on, the server total is the filtered one and the stream cannot tell us
      // how many matching entries exist beyond the page.
      total: fetchedTotal + (unfiltered ? arrived : 0),
    };
  }, [fetched, fetchedTotal, filters, live]);

  // The distribution and the alert feed are derived from the trail on screen:
  // the contract has no per-category breakdown and no anomaly endpoint, so
  // both are computed rather than hardcoded (the Task 76 rule).
  const distribution = useMemo(() => {
    const counts: Record<AuditCategory, number> = {
      authentication: 0,
      scan_completion: 0,
      report_release: 0,
      administrative: 0,
      security_event: 0,
      system: 0,
    };
    for (const item of entries) counts[item.category] += 1;
    return (Object.keys(DISTRIBUTION_LABELS) as AuditCategory[]).map((category) => ({
      category,
      count: counts[category],
    }));
  }, [entries]);
  const distributionTotal = entries.length;

  const alerts = useMemo(() => entries.filter((item) => item.severity === 'critical'), [entries]);

  const updateParams = (patch: Partial<AuditToolbarValues>): void => {
    const params = new URLSearchParams();
    const merged: AuditToolbarValues = {
      q: filters.q,
      category: filters.category,
      severity: filters.severity,
      actor: filters.actor,
      range: filters.range,
      ...patch,
    };
    for (const [key, value] of Object.entries(merged)) {
      // `range` always travels: it has a contract default, not an empty state.
      if (value !== '' && !(key === 'range' && value === DEFAULT_RANGE)) params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs === '' ? '/admin/audit' : `/admin/audit?${qs}`);
  };

  const resetFilters = (): void => {
    router.replace('/admin/audit');
    toast({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full cryptographic audit trail.',
    });
  };

  const onVerify = (): void => {
    verify.mutate(
      {},
      {
        onSuccess: (result) => {
          const checked = result.entries;
          const integrity =
            checked === 0 ? 100 : Math.round(((checked - result.mismatches) / checked) * 100);
          setMismatchSeq(result.firstMismatchSeq);
          toast({
            kind: result.mismatches === 0 ? 'ok' : 'crit',
            title: 'Hash chain verified',
            message: `${countFormatter.format(checked)} entries checked · ${result.mismatches} mismatches · chain integrity ${integrity}%.`,
          });
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 409 && error.code === 'verify_in_progress') {
            toast({ kind: 'warn', title: 'Verification already running' });
            return;
          }
          toast({
            kind: 'crit',
            title: 'Verification failed',
            message: isApiError(error) ? error.message : 'Please try again.',
          });
        },
      },
    );
  };

  const onIntegrityCheck = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['audit', 'chain'] }).then(() => {
      const state = chain.data?.state ?? 'intact';
      const verifiedAt = chain.data?.lastVerifiedAt;
      toast({
        kind: state === 'intact' ? 'ok' : 'crit',
        title: 'Integrity check complete',
        message: `Chain state: ${state} · last verified at ${
          verifiedAt === undefined || verifiedAt === null
            ? '—'
            : formatUtcClock(new Date(verifiedAt))
        }.`,
      });
    });
  };

  const onExport = async (): Promise<void> => {
    setExporting(true);
    const outcome = await exportAuditCsv(filters);
    setExporting(false);
    if (outcome === 'downloaded') {
      toast({
        kind: 'ok',
        title: 'Compliance export ready',
        message: `Signed CSV bundle generated for ${AUDIT_RANGE_LABELS[filters.range]} at ${formatUtcClock(new Date())}.`,
      });
      return;
    }
    toast({
      kind: outcome === 'range_too_large' ? 'warn' : 'crit',
      title: 'Export unavailable',
      message:
        outcome === 'range_too_large'
          ? 'Narrow the time range — the requested window is too large to sign.'
          : 'The compliance bundle could not be generated. Please try again.',
    });
  };

  const onRefresh = (): void => {
    // Resync the socket too: the server replays from `Last-Event-ID`, so the
    // tail catches up on whatever the current subscription missed.
    stream.resync();
    void queryClient.invalidateQueries({ queryKey: ['audit'] }).then(() =>
      toast({
        kind: 'ok',
        title: 'Stream refreshed',
        message: `Audit tail resynced at ${formatUtcClock(new Date())}.`,
      }),
    );
  };

  const onTogglePause = (): void => {
    if (stream.paused) stream.resume();
    else stream.pause();
  };

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Cryptographic System Audit Trail"
        title="System Audit Logs"
        description="Immutable, hash-chained record of every security event, authentication attempt, scan completion and administrative report release across the VUNVAULT platform. Writes are append-only and every entry is signed with AES-256-GCM."
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="al-verify-chain"
              disabled={!canRead || verify.isPending}
              onClick={onVerify}
            >
              {verify.isPending ? (
                <RefreshCw size={15} aria-hidden="true" className="animate-spin" />
              ) : (
                <ShieldCheck size={15} aria-hidden="true" />
              )}
              <span>Verify Hash Chain</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              id="al-export-logs"
              disabled={!canRead || exporting}
              onClick={() => void onExport()}
            >
              <Download size={15} aria-hidden="true" />
              <span>Export Compliance Data</span>
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              id="al-refresh-stream"
              onClick={onRefresh}
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>Refresh Stream</span>
            </button>
          </>
        }
      />

      <section aria-labelledby="al-kpi-heading">
        <h2 id="al-kpi-heading" className="sr-only">
          Audit trail indicators
        </h2>
        <AuditSummary />
      </section>

      <div className="al-layout">
        <div className="al-col">
          <AuditToolbar
            values={{
              q: filters.q,
              category: filters.category,
              severity: filters.severity,
              actor: filters.actor,
              range: filters.range,
            }}
            shown={entries.length}
            total={total}
            onChange={updateParams}
            onReset={resetFilters}
          />
          <AuditTable
            entries={entries}
            total={total}
            isLoading={trail.isLoading}
            chain={chain.data ?? null}
            mismatchSeq={mismatchSeq}
            streamStatus={stream.status}
            pausedCount={stream.bufferedCount}
            onTogglePause={onTogglePause}
            onOpenEntry={setEntry}
            onResetFilters={resetFilters}
          />
        </div>

        <aside className="al-col" aria-label="Audit integrity controls">
          <ChainPanel
            chain={chain.data ?? null}
            isLoading={chain.isLoading}
            entries={entries}
            isChecking={chain.isFetching}
            onRunIntegrityCheck={onIntegrityCheck}
          />

          <section className="adm-card adm-card--dark" aria-labelledby="al-dist-heading">
            <div className="adm-card-head">
              <div>
                <h2 className="adm-card-title" id="al-dist-heading">
                  <PieChart size={15} aria-hidden="true" />
                  Event Distribution (24h)
                </h2>
                <p className="adm-card-note">
                  {summary.data === undefined ? '—' : countFormatter.format(summary.data.events24h)}{' '}
                  total events recorded across the platform.
                </p>
              </div>
              <span className="adm-tag">24h</span>
            </div>
            <div className="adm-card-body">
              <div className="al-dist">
                {distribution.map(({ category, count }) => (
                  <div className="al-dist-row" key={category}>
                    <span className="al-dist-name">{DISTRIBUTION_LABELS[category]}</span>
                    <progress
                      className="al-dist-bar"
                      value={count}
                      max={Math.max(1, distributionTotal)}
                    >
                      {count}
                    </progress>
                    <span className="al-dist-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="adm-card adm-card--dark" aria-labelledby="al-alerts-heading">
            <div className="adm-card-head">
              <div>
                <h2 className="adm-card-title" id="al-alerts-heading">
                  <TriangleAlert size={15} aria-hidden="true" />
                  Active Alerts
                </h2>
                <p className="adm-card-note">Anomalies flagged by the audit stream monitor.</p>
              </div>
              <span className="adm-tag adm-tag--crit">{alerts.length} Open</span>
            </div>
            <div className="adm-card-body">
              {alerts.length === 0 ? (
                <p className="al-panel-empty">
                  <Activity size={12} aria-hidden="true" /> No anomalies in the current window.
                </p>
              ) : (
                <div className="al-alerts">
                  {alerts.map((alert) => (
                    <div className="al-alert" key={alert.id}>
                      <span className="al-alert-dot" aria-hidden="true" />
                      <span className="al-alert-body">
                        <span className="al-alert-title">{alert.eventType}</span>
                        <span className="al-alert-text">{alert.message}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <EventDialog
        entry={entry}
        open={entry !== null}
        onOpenChange={(next) => {
          if (!next) setEntry(null);
        }}
      />
    </div>
  );
}

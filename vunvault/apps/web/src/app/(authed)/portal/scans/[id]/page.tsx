'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SCAN_TYPE_LABELS } from '@vunvault/contracts';
import { formatLongDate } from '@vunvault/lib';
import { Badge, Skeleton, type BadgeTone } from '@vunvault/ui';
import { FindingsList } from '../../_components/findings-list';
import { isScanNotFound, useScan, useScanFindings } from '../../_hooks/use-scans';
import '../../_styles/scans.css';

/**
 * `/portal/scans/[id]` (Task 69) — the released report detail: header (job
 * code, target, type, released date), the severity summary as `Badge`s and
 * the findings list. A `404` — the release lock's answer for "not yours, not
 * released, or gone" — renders the standard not-found page via `notFound()`.
 *
 * Client page (React `use(params)`): the read is cookie-authenticated, so it
 * belongs on the client like the rest of the portal's data.
 * No export in v1. TODO(backend-contract): report PDF export endpoint.
 */

const SEVERITY_TONES: Record<'critical' | 'high' | 'medium' | 'low', BadgeTone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const SEVERITY_LABELS: Record<'critical' | 'high' | 'medium' | 'low', string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface ScanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ScanDetailPage({ params }: ScanDetailPageProps) {
  const { id } = use(params);
  const scan = useScan(id);
  const findings = useScanFindings(id);

  if (scan.isLoading || findings.isLoading) {
    return (
      <section className="pt-10 pb-16 md:pt-14 md:pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8" aria-busy="true">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-4 h-4 w-96" />
          <Skeleton className="mt-8 h-40 w-full" />
        </div>
      </section>
    );
  }

  if (scan.error !== null && isScanNotFound(scan.error)) {
    // The release lock does not admit that the job exists.
    notFound();
  }

  const job = scan.data;
  if (job === undefined) {
    return (
      <section className="pt-10 pb-16 md:pt-14 md:pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-ink-muted">The report could not be loaded.</p>
        </div>
      </section>
    );
  }

  const counts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<
    'critical' | 'high' | 'medium' | 'low',
    number
  >;
  for (const finding of findings.data ?? []) counts[finding.severity] += 1;
  // Fixed display order — the same order SEVERITY_PRIORITY ranks them in.
  const severityOrder = ['critical', 'high', 'medium', 'low'] as const;

  return (
    <section className="pt-10 pb-16 md:pt-14 md:pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-muted transition-colors duration-200 ease-vv hover:text-brand-strong"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Your Security Reports
        </Link>

        <div className="vps-detail-head">
          <div>
            <span className="vps-eyebrow">Released report</span>
            <h1 className="vps-detail-title">
              {job.jobCode} · {job.targetHost}
            </h1>
            <div className="vps-detail-meta">
              <span>{SCAN_TYPE_LABELS[job.scanType]}</span>
              <span>
                Released{' '}
                {job.completedAt === null ? '—' : formatLongDate(new Date(job.completedAt))}
              </span>
            </div>
          </div>
          <div className="vps-severity-summary" aria-label="Findings by severity">
            {severityOrder.map((severity) => (
              <Badge key={severity} tone={SEVERITY_TONES[severity]}>
                {SEVERITY_LABELS[severity]} {counts[severity]}
              </Badge>
            ))}
          </div>
        </div>

        {findings.data === undefined || findings.data.length === 0 ? (
          <div className="vps-card mt-8">
            <p className="text-sm text-ink-muted">No findings were recorded for this engagement.</p>
          </div>
        ) : (
          <FindingsList findings={findings.data} />
        )}
      </div>
    </section>
  );
}

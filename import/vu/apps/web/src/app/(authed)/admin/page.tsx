'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileDown, Radar, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatUtcClock } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { AdminPageHead } from './_components/admin-page-head';
import { EndpointsTable } from './_dashboard/endpoints-table';
import { Kpis } from './_dashboard/kpis';
import { NodesPanel } from './_dashboard/nodes-panel';
import { PipelinePanel } from './_dashboard/pipeline-panel';
import { RevenuePanel } from './_dashboard/revenue-panel';
import { RunningScans } from './_dashboard/running-scans';
import { ThreatLevel } from './_dashboard/threat-level';
import { TrafficPanel } from './_dashboard/traffic-panel';
import { TransactionsTable } from './_dashboard/transactions-table';
import { refreshDashboard } from './_dashboard/use-dashboard';
import './_dashboard/dashboard.css';

/**
 * `/admin` — the Administrative Command Center: the KPI strip,
 * revenue + transactions, traffic + endpoints + node load, pipeline +
 * running scans, and the threat level with node connectivity — each on its
 * own dashboard query so one failure degrades one card. Refresh Metrics
 * re-fetches everything with `?refresh=1` (the API's 15 s cache bypass);
 * the 30 s visible-tab auto-refresh lives in the queries.
 *
 * Client page: every figure is cookie-authenticated API data. The head
 * actions link to the nav's own routes : Scan Queue and Audit Logs.
 */

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = (): void => {
    if (refreshing) return;
    setRefreshing(true);
    void refreshDashboard(queryClient)
      .then(() => {
        toast({
          kind: 'ok',
          title: 'Metrics refreshed',
          message: `Dashboard data updated at ${formatUtcClock(new Date())}.`,
        });
      })
      .finally(() => setRefreshing(false));
  };

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Data Analytics Dashboard Overview"
        title="Administrative Command Center"
        description="Consolidated operational intelligence across revenue, network load, job throughput and threat posture. All figures refresh from the VUNVAULT sensor mesh and billing ledger."
        actions={
          <>
            <Link href="/admin/scan-queue" className="adm-btn adm-btn-primary">
              <Radar size={15} aria-hidden="true" />
              <span>Initiate System Scan</span>
            </Link>
            <Link href="/admin/audit" className="adm-btn adm-btn-dark">
              <FileDown size={15} aria-hidden="true" />
              <span>Export Audit Logs</span>
            </Link>
            <button
              type="button"
              className="adm-btn adm-btn-ghost"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>Refresh Metrics</span>
            </button>
          </>
        }
      />

      <Kpis />

      <section aria-labelledby="adm-revenue-heading" className="adm-grid">
        <RevenuePanel />
        <TransactionsTable />
      </section>

      <section aria-labelledby="adm-traffic-heading" className="adm-grid">
        <TrafficPanel />
        <EndpointsTable />
        <NodesPanel variant="load" />
      </section>

      <section aria-labelledby="adm-pipeline-heading" className="adm-grid">
        <PipelinePanel />
        <RunningScans />
      </section>

      <section aria-labelledby="adm-threat-heading" className="adm-grid">
        <ThreatLevel />
        <NodesPanel variant="connectivity" />
      </section>
    </div>
  );
}

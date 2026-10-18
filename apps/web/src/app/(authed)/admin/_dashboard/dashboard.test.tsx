// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  dashboardKpis,
  endpointStats,
  nodes as nodesFixture,
  pipelineSummary,
  revenueSummary,
  runningScans,
  threatLevel,
  trafficSummary,
  transactions,
} from '@vunvault/contracts/fixtures/dashboard';
import { createQueryClient, formatUsd, formatUsdWhole } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../../mocks/server';
import AdminDashboardPage from '../page';

/**
 * Command Center tests — the spec's list: KPI values + USD
 * formatting from MSW, each panel renders its rows, a 403 HIDES its panel,
 * Refresh Metrics sends `refresh=1` on all nine queries (with the verbatim
 * toast), and no charting library exists in the dependency tree. Every
 * expected figure is fixture-derived — no design number is hard-coded.
 */

let queryClient: QueryClient;

function renderDashboard() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDashboardPage />
    </QueryClientProvider>,
  );
}

/** The `.adm-card` a card title belongs to. */
function cardOf(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: title });
  const card = heading.closest<HTMLElement>('.adm-card');
  if (card === null) throw new Error(`The card for "${title}" is missing.`);
  return card;
}

/** Wait for one panel's query to resolve, then return its card. */
async function cardWhenLoaded(title: string): Promise<HTMLElement> {
  await screen.findByRole('heading', { name: title });
  return cardOf(title);
}

function kpiSection(): HTMLElement {
  const heading = screen.getByRole('heading', { name: 'Key performance indicators' });
  const section = heading.closest('section');
  if (section === null) throw new Error('The KPI section is missing.');
  return section;
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('/admin — KPI strip', () => {
  it('renders the six tiles with API-driven values and USD formatting', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: 'Administrative Command Center' });
    // The tiles appear once the kpis query resolves.
    await screen.findByText('▲ 18 new this month');

    const kpis = kpiSection();
    expect(within(kpis).getAllByRole('article')).toHaveLength(6);
    expect(within(kpis).getByText('Total Paid Clients')).toBeInTheDocument();
    expect(within(kpis).getByText('312')).toBeInTheDocument();
    // Total Revenue via formatUsd — cents included.
    expect(
      within(kpis).getByText(formatUsd(dashboardKpis.totalRevenueUsdCents)),
    ).toBeInTheDocument();
    expect(within(kpis).getByText('▲ 12.4% vs. last quarter')).toBeInTheDocument();
    expect(within(kpis).getByText('Completed Jobs')).toBeInTheDocument();
    expect(within(kpis).getByText('1,842')).toBeInTheDocument();
    expect(within(kpis).getByText('▲ 96 closed this week')).toBeInTheDocument();
    expect(within(kpis).getByText('Pending Review')).toBeInTheDocument();
    expect(within(kpis).getByText('● Awaiting mandatory admin review')).toBeInTheDocument();
    expect(within(kpis).getByText('Active Running Scans')).toBeInTheDocument();
    expect(within(kpis).getByText('● 12 of 24 worker slots in use')).toBeInTheDocument();
    expect(within(kpis).getByText('Critical CVEs Tracked')).toBeInTheDocument();
    expect(within(kpis).getByText('46')).toBeInTheDocument();
    expect(within(kpis).getByText('▲ 9 unpatched · escalation advised')).toBeInTheDocument();
  });
});

describe('/admin — panels', () => {
  it('the revenue card renders the ledger rollup and the tier bars', async () => {
    renderDashboard();
    const revenue = await cardWhenLoaded('Revenue & Paid Scans');
    expect(
      within(revenue).getByText(formatUsdWhole(revenueSummary.grossRevenueYtdUsdCents)),
    ).toBeInTheDocument();
    expect(
      within(revenue).getByText(formatUsdWhole(revenueSummary.revenueThisMonthUsdCents)),
    ).toBeInTheDocument();
    expect(within(revenue).getByText(revenueSummary.periodLabel)).toBeInTheDocument();
    expect(within(revenue).getByText('284 SME · 22 SACCO · 6 Enterprise')).toBeInTheDocument();
    expect(
      within(revenue).getByText(formatUsdWhole(revenueSummary.averageOrderValueUsdCents)),
    ).toBeInTheDocument();
    expect(within(revenue).getByText('Ledger Synced')).toBeInTheDocument();
    expect(within(revenue).getByText('Starter Scan')).toBeInTheDocument();
    expect(within(revenue).getAllByText('41%').length).toBeGreaterThan(0);
    expect(
      within(revenue).getByText(
        'Tier shares are computed on gross revenue for the trailing 90 days.',
      ),
    ).toBeInTheDocument();
  });

  it('the transactions table renders rows, chips and the totals footer', async () => {
    renderDashboard();
    const txns = await cardWhenLoaded('Recent Payment Transactions');
    expect(within(txns).getByText('VX-90241')).toBeInTheDocument();
    expect(within(txns).getByText('Horizon SACCO')).toBeInTheDocument();
    expect(within(txns).getByText('24 Sep · 09:14')).toBeInTheDocument();
    expect(within(txns).getAllByText('M-Pesa').length).toBe(2);
    expect(within(txns).getByText('Bank transfer')).toBeInTheDocument();
    expect(within(txns).getAllByText(formatUsdWhole(249900)).length).toBe(2);
    expect(within(txns).getAllByText('Settled')).toHaveLength(4);
    expect(within(txns).getByText('Pending')).toBeInTheDocument();
    expect(within(txns).getByText('Refunded')).toBeInTheDocument();
    expect(
      within(txns).getByText(formatUsdWhole(transactions.totals.totalUsdCents)),
    ).toBeInTheDocument();
    expect(
      within(txns).getByText(
        `${transactions.totals.settled} settled · ${transactions.totals.pending} pending · ${transactions.totals.refunded} refunded`,
      ),
    ).toBeInTheDocument();
    expect(within(txns).getByText('Reconcile Ledger')).toBeInTheDocument();
  });

  it('the traffic card renders the dl and the CSS hourly chart', async () => {
    renderDashboard();
    const traffic = await cardWhenLoaded('Traffic & Network Load');
    expect(within(traffic).getByText('48,392')).toBeInTheDocument();
    expect(within(traffic).getByText('▲ 6.2% day over day')).toBeInTheDocument();
    expect(within(traffic).getByText('2.14M')).toBeInTheDocument();
    expect(within(traffic).getByText('Across 41 endpoints')).toBeInTheDocument();
    expect(within(traffic).getByText('142')).toBeInTheDocument();
    expect(within(traffic).getByText('ms · p95 384 ms')).toBeInTheDocument();
    expect(within(traffic).getByText('Peak 00:00 UTC · 0.31M')).toBeInTheDocument();
    expect(within(traffic).getByText('00h')).toBeInTheDocument();
    expect(within(traffic).getByText('24h')).toBeInTheDocument();
    expect(within(traffic).getByText('0.31')).toBeInTheDocument();
    // No charting library — the bars are plain styled spans.
    expect(traffic.querySelectorAll('.adm-bar-fill')).toHaveLength(trafficSummary.hourly.length);
  });

  it('the endpoints table renders rows and the computed aggregate', async () => {
    renderDashboard();
    const endpoints = await cardWhenLoaded('Top Endpoints by Load');
    expect(within(endpoints).getByText('/api/v1/scan/submit')).toBeInTheDocument();
    expect(within(endpoints).getByText('412,880')).toBeInTheDocument();
    expect(within(endpoints).getByText('168 ms')).toBeInTheDocument();
    expect(within(endpoints).getByText('0.21%')).toBeInTheDocument();
    expect(within(endpoints).getByText('Aggregate')).toBeInTheDocument();

    const totalRequests = endpointStats.reduce((sum, row) => sum + row.requests, 0);
    const meanLatency = Math.round(
      endpointStats.reduce((sum, row) => sum + row.avgLatencyMs, 0) / endpointStats.length,
    );
    const meanErrorBp = Math.round(
      endpointStats.reduce((sum, row) => sum + Math.round(row.errorRatio * 100), 0) /
        endpointStats.length,
    );
    expect(within(endpoints).getByText(totalRequests.toLocaleString('en-US'))).toBeInTheDocument();
    expect(within(endpoints).getByText(`${meanLatency} ms`)).toBeInTheDocument();
    expect(within(endpoints).getByText(`${(meanErrorBp / 100).toFixed(2)}%`)).toBeInTheDocument();
  });

  it('the nodes panels render in both placements with chips, load and heartbeat', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: 'Sensor Node Load Distribution' });
    await screen.findByRole('heading', { name: 'Sensor Node Network Connectivity' });

    // Both placements render the fleet.
    await waitFor(() => expect(screen.getAllByText('node-nbo-01')).toHaveLength(2));
    expect(screen.getByText('412 / 412 online')).toBeInTheDocument();
    expect(screen.getByText('412 / 412 Online')).toBeInTheDocument();
    expect(screen.getByText('Nairobi Core · 41,200 req/min')).toBeInTheDocument();
    expect(screen.getByText('Nairobi Core · Kenya')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Node load is sampled every 15 seconds from the heartbeat mesh and averaged over a 5-minute window.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connectivity is confirmed by a signed heartbeat every 15 seconds. Two consecutive misses mark a node as degraded; three mark it offline.',
      ),
    ).toBeInTheDocument();

    // Status chips use NODE_STATUS_LABELS; drift formats with the ± sign.
    expect(screen.getAllByText('Operational').length).toBeGreaterThan(0);
    expect(screen.getAllByText('High Load').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Drift Warning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('±19 ms').length).toBeGreaterThan(0);
  });

  it('the pipeline card renders the dl and the computed distribution', async () => {
    renderDashboard();
    const pipeline = await cardWhenLoaded('Job Progress & Status');
    expect(
      within(pipeline).getByText(`${pipelineSummary.unreviewedJobs} Awaiting Review`),
    ).toBeInTheDocument();
    expect(within(pipeline).getByText('96 closed in the last 7 days')).toBeInTheDocument();
    expect(within(pipeline).getByText('Queued, not yet assigned')).toBeInTheDocument();
    expect(within(pipeline).getByText('Admin review required before release')).toBeInTheDocument();
    expect(within(pipeline).getByText('12 of 24 worker slots occupied')).toBeInTheDocument();
    expect(within(pipeline).getByText('Pipeline Distribution')).toBeInTheDocument();

    const total =
      pipelineSummary.distribution.completed +
      pipelineSummary.distribution.pending +
      pipelineSummary.distribution.unreviewed +
      pipelineSummary.distribution.running;
    const completedShare = Math.round((pipelineSummary.distribution.completed / total) * 100);
    expect(within(pipeline).getAllByText(`${completedShare}%`).length).toBeGreaterThan(0);
    expect(
      within(pipeline).getByText(
        'Unreviewed jobs are held for a maximum of 72 hours before automatic escalation to the on-call lead.',
      ),
    ).toBeInTheDocument();
  });

  it('the running-scans monitor renders telemetry rows and the shown/total note', async () => {
    renderDashboard();
    const scans = await cardWhenLoaded('Active Running Scans Monitor');
    expect(within(scans).getByText('12 Active')).toBeInTheDocument();
    expect(within(scans).getByText('JOB-4471')).toBeInTheDocument();
    expect(within(scans).getByText('api.horizonsacco.co.ke')).toBeInTheDocument();
    expect(within(scans).getByText('External')).toBeInTheDocument();
    expect(within(scans).getByText('e.reed')).toBeInTheDocument();
    expect(within(scans).getByText('78%')).toBeInTheDocument();
    expect(within(scans).getByText('4m 12s')).toBeInTheDocument();
    expect(within(scans).getByText('13m 05s')).toBeInTheDocument();
    expect(
      within(scans).getByText(
        `Showing ${runningScans.shown} of ${runningScans.total} active jobs · ${
          runningScans.total - runningScans.shown
        } more running on the secondary worker pool`,
      ),
    ).toBeInTheDocument();
    expect(within(scans).getByRole('link', { name: 'Open Scan Queue' })).toHaveAttribute(
      'href',
      '/admin/scan-queue',
    );
    expect(within(scans).getByRole('progressbar', { name: 'JOB-4471 progress' })).toHaveAttribute(
      'aria-valuenow',
      '78',
    );
  });

  it('the threat card renders the meter, the escalation line and the blocked bars', async () => {
    renderDashboard();
    const threat = await cardWhenLoaded('Zero-Day Threat Level');
    expect(within(threat).getByText('Current Level')).toBeInTheDocument();
    expect(within(threat).getByText(`LEVEL ${threatLevel.level} / 5`)).toBeInTheDocument();
    // level 4 ≥ THREAT_ESCALATION_LEVEL → the verbatim escalation badge.
    expect(
      within(threat).getByText('Escalated to the incident commander on duty.'),
    ).toBeInTheDocument();
    expect(within(threat).getByText('1,284')).toBeInTheDocument();
    expect(within(threat).getByText('9 currently unpatched')).toBeInTheDocument();
    expect(within(threat).getByText('Active exploitation confirmed')).toBeInTheDocument();
    expect(within(threat).getByText('Perimeter + endpoint sensors')).toBeInTheDocument();
    // The API label (fixture: High) — tag AND legend.
    expect(within(threat).getAllByText(threatLevel.label).length).toBeGreaterThan(0);
    expect(within(threat).getByText('Guarded')).toBeInTheDocument();
    expect(within(threat).getByText('Severe')).toBeInTheDocument();
    expect(
      within(threat).getByText(
        'Threat level is recalculated hourly. A level of 4 or above triggers automatic escalation to the incident commander on duty.',
      ),
    ).toBeInTheDocument();

    // The 7-day blocked figure.
    expect(await screen.findByText('Threats Blocked — Last 7 Days')).toBeInTheDocument();
    expect(
      screen.getByText(`Total ${threatLevel.threatsBlockedYtd.toLocaleString('en-US')}`),
    ).toBeInTheDocument();
    expect(screen.getByText('1,640')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
  });

  it('a 403 hides its panel without touching the others', async () => {
    server.use(
      http.get('*/api/v1/admin/dashboard/revenue', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    );
    renderDashboard();
    await screen.findByRole('heading', { name: 'Recent Payment Transactions' });

    // The revenue card is GONE — a permission answer is not an error…
    expect(screen.queryByText('Revenue & Paid Scans')).not.toBeInTheDocument();
    expect(screen.queryByText('Ledger Synced')).not.toBeInTheDocument();
    expect(screen.queryByText('Metrics unavailable')).not.toBeInTheDocument();
    // …while its section-mates still render.
    expect(screen.getByText('Recent Payment Transactions')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Job Progress & Status' }),
    ).toBeInTheDocument();
  });

  it('a failing panel degrades to Metrics unavailable + Retry', async () => {
    server.use(
      http.get('*/api/v1/admin/dashboard/traffic', () =>
        HttpResponse.json({ error: 'unavailable' }, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByText('Metrics unavailable')).toBeInTheDocument();
    // Retry re-runs the query (still failing — the card stays degraded).
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Metrics unavailable')).toBeInTheDocument());
  });
});

describe('/admin — refresh', () => {
  it('Refresh Metrics re-fetches all nine queries with refresh=1 and toasts', async () => {
    const urls: string[] = [];
    const sections = {
      kpis: { data: dashboardKpis },
      revenue: { data: revenueSummary },
      transactions: transactions,
      traffic: { data: trafficSummary },
      endpoints: { data: endpointStats },
      nodes: nodesFixture,
      pipeline: { data: pipelineSummary },
      'running-scans': runningScans,
      'threat-level': { data: threatLevel },
    } as const;
    for (const [section, payload] of Object.entries(sections)) {
      server.use(
        http.get(`*/api/v1/admin/dashboard/${section}`, ({ request }) => {
          urls.push(request.url);
          return HttpResponse.json(payload);
        }),
      );
    }
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('heading', { name: 'Administrative Command Center' });
    await screen.findByText('VX-90241');

    await user.click(screen.getByRole('button', { name: 'Refresh Metrics' }));

    await waitFor(() => {
      for (const section of Object.keys(sections)) {
        expect(
          urls.some(
            (url) => url.includes(`/admin/dashboard/${section}`) && url.includes('refresh=1'),
          ),
          `${section} was not re-fetched with refresh=1`,
        ).toBe(true);
      }
    });
    await waitFor(() => {
      const entry = useToastStore
        .getState()
        .toasts.find((candidate) => candidate.title === 'Metrics refreshed');
      expect(entry).toBeDefined();
      expect(entry?.message).toMatch(/^Dashboard data updated at \d{2}:\d{2}:\d{2} UTC\.$/);
    });
  });
});

describe('/admin — dependencies', () => {
  it('no charting library is installed anywhere in the workspace', () => {
    const forbidden = /chart|recharts|d3|visx|nivo|apexcharts|echarts|plotly|victory|highcharts/i;
    for (const manifest of [
      resolve(process.cwd(), 'package.json'),
      resolve(process.cwd(), '../../package.json'),
    ]) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const name of [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ]) {
        expect(name, `${manifest} depends on ${name}`).not.toMatch(forbidden);
      }
    }
  });
});

/**
 * Home-page constants .
 *
 * The public site has no stats endpoint yet — the hero metrics and the CVE
 * ticker are the design's values, kept verbatim until a public API feeds
 * them.
 */

export interface HeroMetric {
  label: string;
  value: string;
}

export interface TickerItem {
  cve: string;
  text: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// TODO(backend-contract): public stats endpoint
export const HERO_METRICS: readonly HeroMetric[] = [
  { label: 'Nodes Monitored', value: '1,284' },
  { label: 'Threats Blocked', value: '12,904' },
  { label: 'Mean Patch Time', value: '1.2s' },
];

// TODO(backend-contract): public stats endpoint
export const TICKER_ITEMS: readonly TickerItem[] = [
  {
    cve: 'CVE-2025-18820',
    text: '– SQL injection in unsanitized search parameter',
    severity: 'MEDIUM',
  },
  {
    cve: 'CVE-2026-9122',
    text: '– Critical Remote Code Execution in API Ingress',
    severity: 'CRITICAL',
  },
  {
    cve: 'CVE-2026-4401',
    text: '– Directory Traversal in Unauthenticated RMM Agent',
    severity: 'HIGH',
  },
  {
    cve: 'CVE-2026-1104',
    text: '– Zero-Day Memory Exfiltration Attempt Intercepted',
    severity: 'HIGH',
  },
];

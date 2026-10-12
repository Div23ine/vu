// TODO(backend-contract): no public zero-day teaser endpoint exists; fixture constants for the marketing page

/**
 * Zero-Day Exploit Tracking constants (Task 50).
 *
 * The dashboard widget on the marketing site is a teaser: the prototype's
 * values, verbatim, until a public endpoint exists. The admin Command Center
 * (Part 4) gets the real, authenticated feed.
 */

export interface FeedRow {
  severity: 'Critical' | 'High' | 'Medium';
  cve: string;
  /** `HH:MM:SS` (UTC), as displayed. */
  time: string;
  title: string;
  /** `scope · vendor · CVSS x.x` line. */
  meta: string;
  patch: 'Unpatched' | 'Patch in progress' | 'Patched';
}

export const ZERO_DAY_FEED: readonly FeedRow[] = [
  {
    severity: 'Critical',
    cve: 'CVE-2026-21447',
    time: '14:36:45',
    title: 'Apache Struts 2 — OGNL injection RCE',
    meta: 'Web & API · Apache Software Foundation · CVSS 9.8',
    patch: 'Unpatched',
  },
  {
    severity: 'Critical',
    cve: 'CVE-2026-0091',
    time: '14:35:12',
    title: 'Cisco IOS XE — Web UI authentication bypass',
    meta: 'Network & Edge · Cisco · CVSS 9.1',
    patch: 'Patch in progress',
  },
  {
    severity: 'High',
    cve: 'CVE-2026-3327',
    time: '14:32:01',
    title: 'Oracle WebLogic Server — deserialization RCE',
    meta: 'Web & API · Oracle · CVSS 8.8',
    patch: 'Unpatched',
  },
  {
    severity: 'High',
    cve: 'CVE-2026-18820',
    time: '14:28:55',
    title: 'Microsoft Windows Print Spooler — privilege escalation',
    meta: 'Endpoint / Desktop · Microsoft · CVSS 8.1',
    patch: 'Patched',
  },
  {
    severity: 'Critical',
    cve: 'CVE-2025-53112',
    time: '14:25:11',
    title: 'Google Chrome V8 — type confusion in JIT',
    meta: 'Endpoint / Desktop · Google · CVSS 9.6',
    patch: 'Patched',
  },
  {
    severity: 'High',
    cve: 'CVE-2026-1104',
    time: '14:21:40',
    title: 'Linux Kernel io_uring — use-after-free memory corruption',
    meta: 'OT / ICS · Linux Kernel · CVSS 7.8',
    patch: 'Patched',
  },
];

export interface ZeroDayStat {
  label: string;
  value: string;
  /** Small unit rendered after the value (`s` on the Mean-Time card). */
  unit?: string;
  delta: string;
  /** lucide icon name resolved by the widget. */
  icon: 'bug' | 'crosshair' | 'shield-check' | 'timer';
}

export const ZERO_DAY_STATS: readonly ZeroDayStat[] = [
  {
    label: 'Total Active Zero-Days',
    value: '1,284',
    delta: '▲ 62 this week',
    icon: 'bug',
  },
  {
    label: 'Weaponized in the Wild',
    value: '37',
    delta: '● Active exploitation',
    icon: 'crosshair',
  },
  {
    label: 'Patched Vulnerabilities',
    value: '37,910',
    delta: '▼ 18% open backlog',
    icon: 'shield-check',
  },
  {
    label: 'Mean Time to Patch',
    value: '1.2',
    unit: 's',
    delta: 'Automated validation',
    icon: 'timer',
  },
];

export const ZERO_DAY_TABS = [
  'Dashboard',
  'Live Feed',
  'Exploit DB',
  'Patch Status',
  'Vendors',
  'Reports',
] as const;

export interface StatusCounter {
  label: string;
  value: string;
}

export const ZERO_DAY_STATUS_COUNTERS: readonly StatusCounter[] = [
  { label: 'Active Zero-Days', value: '1,284' },
  { label: 'Weaponized in Wild', value: '37' },
  { label: 'Critical Unpatched', value: '46' },
];

export const SENSORS_ONLINE = '412 / 412';
export const PATCH_COVERAGE_PERCENT = 68;

export const ZERO_DAY_QUICK_ACTIONS = [
  'Run CVE Scan',
  'Isolate Asset',
  'Push Patch',
  'Advisories',
] as const;

export const ZERO_DAY_FOOTNOTE =
  'Refreshed continuously from NVD, vendor advisories and the VUNVAULT sensor network. Times shown in UTC.';

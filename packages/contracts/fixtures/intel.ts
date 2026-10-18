import type { Advisory, AdvisorySummary, BroadcastEstimate, DraftListItem } from '../src/intel.js';

/**
 * Zero-Day desk fixtures, published on 2026-09-24 (all times UTC).
 *
 * `summary` and `remediation` are fixture-only one-liners — the catalogue
 * supplies the CVE, title, scope, severity, broadcast time, reach and patch
 * status, and no client-facing body copy.
 */

const AUTHOR = {
  hassan: { id: 'c0000000-0000-4000-8000-000000000004', label: 'f.hassan' },
  reed: { id: 'c0000000-0000-4000-8000-000000000001', label: 'e.reed' },
  mwangi: { id: 'c0000000-0000-4000-8000-000000000003', label: 'd.mwangi' },
} as const;

function advisoryId(index: number): string {
  return `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

export const advisories: Advisory[] = [
  {
    id: advisoryId(1),
    cveId: 'CVE-2026-21447',
    vendor: 'Apache',
    cvss: 9.8,
    disclosureDate: '2026-09-22',
    severity: 'critical',
    weaponized: true,
    publicPoc: true,
    preAuth: true,
    patchAvailable: false,
    title: 'Apache Struts 2 — OGNL injection RCE',
    summary:
      'An OGNL expression injected through a request header is evaluated by the Struts 2 filter chain, allowing unauthenticated remote code execution.',
    remediation:
      'Upgrade to a fixed Struts 2 release. Where an upgrade is not possible, block requests carrying OGNL syntax at the edge and enable strict method invocation.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-21447'],
    scope: [{ label: 'Struts 2.0.0 – 2.5.32', category: 'web_api' }],
    status: 'published',
    patchStatus: 'unpatched',
    author: { ...AUTHOR.hassan },
    lastSavedAt: '2026-09-24T14:30:00Z',
    publishedAt: '2026-09-24T14:36:00Z',
    lastBroadcastAt: '2026-09-24T14:36:00Z',
    reach: 312,
  },
  {
    id: advisoryId(2),
    cveId: 'CVE-2026-0091',
    vendor: 'Cisco',
    cvss: 9.6,
    disclosureDate: '2026-09-21',
    severity: 'critical',
    weaponized: true,
    publicPoc: true,
    preAuth: true,
    patchAvailable: false,
    title: 'Cisco IOS XE — Web UI authentication bypass',
    summary:
      'The IOS XE web management interface accepts a crafted session token, granting administrative access without credentials.',
    remediation:
      'Disable the HTTP server on internet-facing interfaces and restrict management access to a dedicated out-of-band network until the vendor patch is applied.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-0091'],
    scope: [{ label: 'IOS XE 17.x', category: 'network_edge' }],
    status: 'published',
    patchStatus: 'patch_in_progress',
    author: { ...AUTHOR.reed },
    lastSavedAt: '2026-09-24T14:29:00Z',
    publishedAt: '2026-09-24T14:35:00Z',
    lastBroadcastAt: '2026-09-24T14:35:00Z',
    reach: 284,
  },
  {
    id: advisoryId(3),
    cveId: 'CVE-2026-3327',
    vendor: 'Oracle',
    cvss: 8.4,
    disclosureDate: '2026-09-20',
    severity: 'high',
    weaponized: false,
    publicPoc: true,
    preAuth: false,
    patchAvailable: false,
    title: 'Oracle WebLogic — deserialization RCE',
    summary:
      'Unsafe deserialization of a T3 protocol payload allows an authenticated operator to execute code in the WebLogic server process.',
    remediation:
      'Disable the T3 and IIOP protocols where they are not required, and apply the vendor critical patch update at the next maintenance window.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-3327'],
    scope: [{ label: 'WebLogic 12.2.1.x', category: 'web_api' }],
    status: 'published',
    patchStatus: 'unpatched',
    author: { ...AUTHOR.hassan },
    lastSavedAt: '2026-09-24T14:26:00Z',
    publishedAt: '2026-09-24T14:32:00Z',
    lastBroadcastAt: '2026-09-24T14:32:00Z',
    reach: 196,
  },
  {
    id: advisoryId(4),
    cveId: 'CVE-2026-18820',
    vendor: 'Microsoft',
    cvss: 7.8,
    disclosureDate: '2026-09-18',
    severity: 'high',
    weaponized: false,
    publicPoc: false,
    preAuth: false,
    patchAvailable: true,
    title: 'Windows Print Spooler — privilege escalation',
    summary:
      'A local attacker with print-queue access can escalate to SYSTEM through an unchecked spooler driver call.',
    remediation:
      'Apply the September security update. Where printing is not required, stop and disable the Print Spooler service.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-18820'],
    scope: [{ label: 'Windows 10 / 11', category: 'endpoint_desktop' }],
    status: 'published',
    patchStatus: 'patched',
    author: { ...AUTHOR.mwangi },
    lastSavedAt: '2026-09-24T14:22:00Z',
    publishedAt: '2026-09-24T14:28:00Z',
    lastBroadcastAt: '2026-09-24T14:28:00Z',
    reach: 298,
  },
  {
    id: advisoryId(5),
    cveId: 'CVE-2025-53112',
    vendor: 'Google',
    cvss: 9.1,
    disclosureDate: '2026-09-17',
    severity: 'critical',
    weaponized: true,
    publicPoc: true,
    preAuth: false,
    patchAvailable: true,
    title: 'Google Chrome V8 — type confusion in JIT',
    summary:
      'A type confusion in the V8 JIT compiler allows a malicious page to escape the renderer sandbox.',
    remediation:
      'Update Chrome to 128.0.6 or later and enforce automatic updates through endpoint policy.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2025-53112'],
    scope: [{ label: 'Chrome < 128.0.6', category: 'endpoint_desktop' }],
    status: 'published',
    patchStatus: 'patched',
    author: { ...AUTHOR.hassan },
    lastSavedAt: '2026-09-24T14:19:00Z',
    publishedAt: '2026-09-24T14:25:00Z',
    lastBroadcastAt: '2026-09-24T14:25:00Z',
    reach: 305,
  },
  {
    id: advisoryId(6),
    cveId: 'CVE-2026-1104',
    vendor: 'Linux',
    cvss: 7.5,
    disclosureDate: '2026-09-16',
    severity: 'high',
    weaponized: false,
    publicPoc: false,
    preAuth: false,
    patchAvailable: true,
    title: 'Linux Kernel io_uring — use-after-free',
    summary:
      'A use-after-free in the io_uring completion path can be triggered by an unprivileged local process.',
    remediation:
      'Update to a patched kernel, or disable io_uring with `kernel.io_uring_disabled=2` where workloads do not require it.',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-1104'],
    scope: [{ label: 'Kernel 6.4 – 6.9', category: 'ot_ics' }],
    status: 'published',
    patchStatus: 'patched',
    author: { ...AUTHOR.mwangi },
    lastSavedAt: '2026-09-24T14:15:00Z',
    publishedAt: '2026-09-24T14:21:00Z',
    lastBroadcastAt: '2026-09-24T14:21:00Z',
    reach: 152,
  },
];

export const advisorySummary: AdvisorySummary = {
  activeZeroDays: 1284,
  criticalSeverity: 46,
  unpatchedCritical: 9,
  weaponizedInWild: 37,
  advisoriesPublished: 418,
  broadcastThisMonth: 12,
  openDrafts: 7,
  escalatedDrafts: 3,
  dashboardsReached: 312,
  newClientsThisMonth: 18,
};

export const broadcastEstimate: BroadcastEstimate = {
  dashboards: 312,
  emailContacts: 486,
  smsContacts: 74,
  incidentCommanders: 1,
};

export const drafts: DraftListItem[] = [
  {
    id: advisoryId(7),
    cveId: 'CVE-2026-40118',
    title: 'Kubernetes ingress-nginx — admission webhook bypass',
    authorLabel: 'e.reed',
    lastSavedAt: '2026-09-24T13:58:00Z',
    note: 'Unsaved changes',
  },
  {
    id: advisoryId(8),
    cveId: 'CVE-2026-39980',
    title: 'PostgreSQL — privilege escalation via extension loading',
    authorLabel: 'f.hassan',
    lastSavedAt: '2026-09-24T13:41:00Z',
    note: 'Awaiting reviewer',
  },
  {
    id: advisoryId(9),
    cveId: 'CVE-2026-38771',
    title: 'Redis — ACL bypass in sentinel failover path',
    authorLabel: 'd.mwangi',
    lastSavedAt: '2026-09-24T13:20:00Z',
    note: 'Needs scope entries',
  },
];

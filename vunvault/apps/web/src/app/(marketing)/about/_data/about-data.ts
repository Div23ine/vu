// TODO(backend-contract): team + telemetry constants for the marketing page

/**
 * About page data (Task 53b) — the core-team roster and the System Telemetry
 * panel's constants, verbatim from the prototype. The telemetry figures
 * mirror the home zero-day widget's fixtures (same sensor network story);
 * when a public telemetry endpoint exists, both consumers switch to it.
 */

export interface TeamBadge {
  label: string;
  variant: 'brand' | 'plain' | 'dark';
}

export interface TeamMember {
  name: string;
  role: string;
  initials: string;
  badges: readonly TeamBadge[];
  bio: string;
  skills: readonly string[];
  /** The prototype's `/team/<slug>` meta line — plain text, no route exists. */
  meta: string;
}

export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    name: 'Amara Njoroge',
    role: 'Lead Offensive Security Engineer',
    initials: 'AN',
    badges: [
      { label: 'OSCP', variant: 'brand' },
      { label: 'CRTO', variant: 'brand' },
      { label: '9+ yrs', variant: 'plain' },
      { label: 'Nairobi, KE', variant: 'dark' },
    ],
    bio: 'Leads VUNVAULT’s red-team engagements across SACCOs, fintechs and M-Pesa gateway providers. Amara specialises in web application penetration testing, custom parameter fuzzing pipelines and zero-day research — the kind of work that finds the bug a scanner’s signature list will never reach. She has disclosed seven responsibly-handled vulnerabilities in payment and identity platforms operating in East Africa, and runs the internal exploit-development review that every VUNVAULT finding passes through before it reaches a client report.',
    skills: [
      'Web Pentesting',
      'Parameter Fuzzing',
      'Zero-Day Research',
      'Burp Suite',
      'API Security',
      'Exploit Dev',
    ],
    meta: '/team/amara-njoroge',
  },
  {
    name: 'Daniel Mwangi',
    role: 'Security Automation & Recon Architect',
    initials: 'DM',
    badges: [
      { label: 'Automation', variant: 'brand' },
      { label: 'Recon', variant: 'brand' },
      { label: '7+ yrs', variant: 'plain' },
      { label: 'Remote · KE', variant: 'dark' },
    ],
    bio: 'Builds the reconnaissance and validation engine underneath every VUNVAULT engagement. Daniel owns the multi-threaded SSL/TLS validation tooling, the endpoint-crawling pipeline that turns a single domain into a scored asset map, and the Python and Bash automation that keeps the whole stack reproducible. His rule is blunt: if a check cannot run unattended at 03:00 against a 4,000-host estate and return the same result twice, it does not ship. He also maintains the internal patch-validation CLI used to confirm remediation before we close an engagement.',
    skills: [
      'SSL/TLS Validation',
      'Endpoint Crawling',
      'Python',
      'Bash',
      'Multi-threading',
      'CI Automation',
    ],
    meta: '/team/daniel-mwangi',
  },
  {
    name: 'Fatima Hassan',
    role: 'Threat Intelligence Analyst',
    initials: 'FH',
    badges: [
      { label: 'Threat Intel', variant: 'brand' },
      { label: 'OSINT', variant: 'brand' },
      { label: '6+ yrs', variant: 'plain' },
      { label: 'Mombasa · KE', variant: 'dark' },
    ],
    bio: 'Owns the zero-day tracking feed and the attack-surface mapping methodology that opens every engagement. Fatima spends her week correlating NVD entries, vendor advisories and VUNVAULT sensor telemetry into a single exploitation-status view, and profiling how WAFs actually behave against the payloads we throw at them. Her briefings on ransomware playbooks targeting East African SACCOs are now read by security teams in four countries. She writes the weekly threat note that goes to every retainer client.',
    skills: [
      'Attack Surface Mapping',
      'WAF Analysis',
      'CVE Correlation',
      'MITRE ATT&CK',
      'OSINT',
      'Threat Briefings',
    ],
    meta: '/team/fatima-hassan',
  },
  {
    name: 'Brian Otieno',
    role: 'Compliance & Governance Lead',
    initials: 'BO',
    badges: [
      { label: 'ISO 27001', variant: 'brand' },
      { label: 'GDPR', variant: 'brand' },
      { label: '10+ yrs', variant: 'plain' },
      { label: 'Nairobi, KE', variant: 'dark' },
    ],
    bio: 'Translates raw technical findings into the language regulators and boards actually use. Brian owns the Central Bank cybersecurity standards mapping, GDPR and Kenya Data Protection Act framework alignment, and the rules-of-engagement and non-disclosure agreements that govern every engagement VUNVAULT accepts. He also authors the Academy compliance curriculum and sits in on every scope call, because the fastest way to break a client is to test something nobody authorised you to touch.',
    skills: [
      'CBK Standards',
      'GDPR Mapping',
      'ISO 27001',
      'NDAs & RoE',
      'Policy Design',
      'Curriculum',
    ],
    meta: '/team/brian-otieno',
  },
];

export interface TelemetryAlert {
  severity: 'Critical' | 'High' | 'Medium';
  cve: string;
  msg: string;
  sub: string;
  state: 'Unpatched' | 'In progress' | 'Patched';
}

export const TELEMETRY_ALERTS: readonly TelemetryAlert[] = [
  {
    severity: 'Critical',
    cve: 'CVE-2026-21447',
    msg: 'Apache Struts 2 — OGNL injection RCE',
    sub: 'Web & API · CVSS 9.8 · 14:36:45 UTC',
    state: 'Unpatched',
  },
  {
    severity: 'Critical',
    cve: 'CVE-2026-0091',
    msg: 'Cisco IOS XE — Web UI authentication bypass',
    sub: 'Network & Edge · CVSS 9.1 · 14:35:12 UTC',
    state: 'In progress',
  },
  {
    severity: 'High',
    cve: 'CVE-2026-3327',
    msg: 'Oracle WebLogic — deserialization RCE',
    sub: 'Web & API · CVSS 8.8 · 14:32:01 UTC',
    state: 'Unpatched',
  },
  {
    severity: 'High',
    cve: 'CVE-2026-18820',
    msg: 'Windows Print Spooler — privilege escalation',
    sub: 'Endpoint · CVSS 8.1 · 14:28:55 UTC',
    state: 'Patched',
  },
  {
    severity: 'Critical',
    cve: 'CVE-2025-53112',
    msg: 'Google Chrome V8 — type confusion in JIT',
    sub: 'Endpoint · CVSS 9.6 · 14:25:11 UTC',
    state: 'Patched',
  },
  {
    severity: 'Medium',
    cve: 'CVE-2025-18820',
    msg: 'SQL injection in unsanitised search parameter',
    sub: 'Web & API · CVSS 5.3 · 14:21:40 UTC',
    state: 'Unpatched',
  },
];

export interface TelemetryMetric {
  label: string;
  value: string;
  /** Small suffix rendered after the value (`/412`, `s`). */
  suffix?: string;
  delta: string;
  ok?: boolean;
}

export const TELEMETRY_METRICS: readonly TelemetryMetric[] = [
  { label: 'Sensors Online', value: '412', suffix: '/412', delta: 'All nodes nominal', ok: true },
  { label: 'Assets Monitored', value: '1,284', delta: '▲ 36 this week' },
  { label: 'Threats Blocked', value: '12,904', delta: 'Rolling 30-day window' },
  { label: 'Mean Time to Patch', value: '1.2', suffix: 's', delta: 'Automated validation' },
];

export interface TelemetryCounter {
  label: string;
  value: string;
}

export const TELEMETRY_COUNTERS: readonly TelemetryCounter[] = [
  { label: 'Active zero-days', value: '1,284' },
  { label: 'Weaponized in the wild', value: '37' },
  { label: 'Critical unpatched', value: '46' },
  { label: 'Patched (YTD)', value: '37,910' },
  { label: 'Client estates covered', value: '96' },
];

export const TELEMETRY_PATCH_COVERAGE_PERCENT = 68;

export const TELEMETRY_FOOTNOTE =
  'Refreshed continuously from NVD, vendor advisories and the VUNVAULT sensor network. Times shown in UTC. Telemetry is aggregated and contains no client-identifying data.';

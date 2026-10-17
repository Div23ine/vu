// TODO(backend-contract): team + telemetry constants for the marketing page

/**
 * About page data — the live core-team roster (photographs included) and the
 * System Telemetry panel's constants, verbatim from the prototype. The telemetry figures
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
  /** Square crop served from `apps/web/public/images/contributors/`. */
  photo: string;
  /** Optional rich fields — the card renders them only when present. */
  badges?: readonly TeamBadge[];
  bio?: string;
  skills?: readonly string[];
  /** Monospace foot label (the prototype's `/team/<slug>` line). */
  meta?: string;
}

/**
 * The live roster — same people, order and photographs as the home page's
 * `CONTRIBUTORS` (`(marketing)/_components/home/contributors.tsx`); keep the
 * two in sync. Credential chips, bios, skill chips and meta lines render as
 * soon as they are added per member. Card 6 carries placeholders until the
 * name and role are listed.
 */
export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    name: 'Esther',
    role: 'Cybersecurity and Digital Operations',
    photo: '/images/contributors/contributor-01.jpg',
    bio: 'Esther sits at the intersection of security and operations at VUNVAULT. She keeps the team’s digital workspace, tooling and internal processes hardened and running smoothly — from identity and access hygiene to automating the routine operational work that surrounds every engagement. She also coordinates the digital operations behind client projects, so each one moves securely from kickoff to final report.',
  },
  {
    name: 'Natasha',
    role: 'Cybersecurity Analyst',
    photo: '/images/contributors/contributor-02.jpg',
    bio: 'Natasha monitors, triages and investigates security events across VUNVAULT’s client environments, turning noisy alert streams into clear, actionable findings. She digs into malware behaviour, phishing campaigns and misconfigurations, and documents every step so remediation can be verified rather than assumed. Her analysis feeds directly into the threat briefings VUNVAULT publishes for clients.',
  },
  {
    name: 'Jaymit Sarena',
    role: 'Security Analyst VAPT',
    photo: '/images/contributors/contributor-03.jpg',
    bio: 'Jaymit runs vulnerability assessments and penetration tests across web applications, APIs and network perimeters. He reproduces real-world attack paths, validates every finding to rule out false positives, and pairs each issue with practical, prioritised remediation guidance. His VAPT work helps clients fix what actually matters before an attacker finds it first.',
  },
  {
    name: 'Raphunga Tshepiso',
    role: 'Research Analyst',
    photo: '/images/contributors/contributor-04.jpg',
    bio: 'Raphunga tracks the evolving threat landscape and turns open-source intelligence, vendor advisories and CVE data into structured research the team can act on. She maintains the evidence base behind VUNVAULT’s zero-day tracking and writes the background analysis that supports the advisories and threat briefings the team publishes.',
  },
  {
    name: 'Daniel Okafor',
    role: 'Security and Project Coordinator',
    photo: '/images/contributors/contributor-05.jpg',
    bio: 'Daniel keeps VUNVAULT’s engagements on schedule and in scope, coordinating between clients, analysts and the compliance workload. He pairs that project coordination with hands-on security work: tracking findings through to remediation, maintaining engagement documentation, and making sure every deliverable is reviewed, approved and delivered on time.',
  },
  {
    name: 'Thuku Maina',
    role: 'Marketing Strategist and Social Media Manager',
    photo: '/images/contributors/contributor-06.jpg',
    bio: 'Divine shapes how VUNVAULT communicates its work to the world. He plans and runs the company’s marketing strategy and social media presence, translating deep technical research into clear stories for executives, developers and the wider security community. He also grows the reach of the VUNVAULT Academy and keeps the community channels active and well informed.',
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

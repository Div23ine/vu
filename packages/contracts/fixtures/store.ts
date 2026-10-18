import type { ProductView, PublicContentItem } from '../src/index.js';

/**
 * Fixtures for the store and the public content feed (Task 40b).
 *
 * Product names, categories, prices, unit labels, features and descriptions are the
 * catalogue's verbatim copy — they are what the products page renders, so a drift
 * here is a drift in the shipped site. The six `publicContent` items carry the
 * prototype's titles, excerpts, authors, dates, reading times and severities
 * verbatim; their tags, ids, slugs and image URLs are fixture data.
 *
 * Prototype category labels are mapped onto the Studio's `BlogCategory` enum,
 * because the shipped product has one taxonomy, not two:
 *   Cyber News → news · Cyber Defense → industry_updates · Compliance →
 *   industry_updates · Threat Intel → threat_intel · Incident Response → news ·
 *   Engineering → blog.
 */

export const products: ProductView[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    slug: 'reconvault-pro',
    name: 'ReconVault Pro',
    category: 'Recon',
    description:
      'Continuous attack-surface enumeration engine with subdomain discovery, port fingerprinting and CVE correlation in a single CLI.',
    features: [
      'CT-log & DNS brute subdomain enumeration',
      'Live CVE cross-reference & risk scoring',
      'JSON / SARIF export for CI pipelines',
    ],
    priceUsdCents: 4900,
    unitLabel: 'license',
    settlementCurrency: 'USD',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    slug: 'vulnscope-api',
    name: 'VulnScope API',
    category: 'Scanning',
    description:
      'Headless vulnerability scanner exposed as a REST API — drop authenticated scans straight into your CI/CD or SOC automation.',
    features: [
      'OWASP Top 10 + API abuse detection',
      'Authenticated & unauthenticated scan modes',
      'Webhook alerts & scheduled runs',
    ],
    priceUsdCents: 12_900,
    unitLabel: 'year',
    settlementCurrency: 'USD',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    slug: 'phishguard-kit',
    name: 'PhishGuard Kit',
    category: 'Human Risk',
    description:
      'Authorised phishing-simulation framework with landing-page templates, campaign tracking and staff-awareness scoring.',
    features: [
      '40+ compliance-safe email templates',
      'Per-department risk scoring dashboard',
      'Automated awareness training follow-up',
    ],
    priceUsdCents: 7900,
    unitLabel: 'license',
    settlementCurrency: 'USD',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    slug: 'loghound-siem-pack',
    name: 'LogHound SIEM Pack',
    category: 'Detection',
    description:
      '412 production-tested detection rules mapped to MITRE ATT&CK, packaged for Splunk, Elastic and Wazuh.',
    features: [
      '412 rules across 14 ATT&CK tactics',
      'False-positive tuning notes per rule',
      'Purple-team validation playbooks',
    ],
    priceUsdCents: 19_900,
    unitLabel: 'pack',
    settlementCurrency: 'USD',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    slug: 'payloadforge',
    name: 'PayloadForge',
    category: 'Exploit Dev',
    description:
      'Encoder, obfuscator and payload staging console for authorised red-team engagements and detection-engineering validation.',
    features: [
      'Multi-stage encoding chains',
      'AV / EDR evasion scoring',
      'Signed engagement audit log',
    ],
    priceUsdCents: 9900,
    unitLabel: 'license',
    settlementCurrency: 'USD',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    slug: 'compliancemapper',
    name: 'ComplianceMapper',
    category: 'GRC',
    description:
      'Map scan findings to Central Bank, ISO 27001 and Data Protection requirements, then export a board-ready evidence pack.',
    features: [
      'CBK / ISO 27001 / GDPR control mapping',
      'Evidence pack & audit trail export',
      'Gap analysis with remediation owners',
    ],
    priceUsdCents: 14_900,
    unitLabel: 'year',
    settlementCurrency: 'USD',
  },
];

/** The home page's six seed posts, in the prototype's display order. */
export const publicContent: PublicContentItem[] = [
  {
    id: 'c1000000-0000-4000-8000-000000000001',
    type: 'blog_post',
    title: 'Kenya State House Cyber Security Audit & Risk Analysis',
    excerpt:
      'An investigative analysis of government digital perimeter vulnerabilities and defence protocols.',
    slug: 'kenya-state-house-cyber-security-audit-risk-analysis',
    slugPath: '/blog/kenya-state-house-cyber-security-audit-risk-analysis',
    category: 'news',
    categoryLabel: 'News',
    severity: 'high',
    tags: ['kenya', 'public-sector', 'audit'],
    readMinutes: 7,
    featuredImageUrl: 'https://assets.vunvault.test/blog/state-house-audit.jpg',
    imageAlt: 'Government digital perimeter audit',
    publishedAt: '2026-08-14T09:00:00.000Z',
    author: { fullName: 'VUNVAULT Threat Desk' },
  },
  {
    id: 'c1000000-0000-4000-8000-000000000002',
    type: 'blog_post',
    title: "Africa's Cyber Awakening: How the Continent Is Fighting Back",
    excerpt: 'An in-depth analysis of evolving threat landscapes across Kenya, Ghana and Nigeria.',
    slug: 'africas-cyber-awakening-how-the-continent-is-fighting-back',
    slugPath: '/blog/africas-cyber-awakening-how-the-continent-is-fighting-back',
    category: 'industry_updates',
    categoryLabel: 'Industry Updates',
    severity: 'medium',
    tags: ['africa', 'threat-landscape'],
    readMinutes: 6,
    featuredImageUrl: 'https://assets.vunvault.test/blog/cyber-awakening.jpg',
    imageAlt: 'Continental threat landscape',
    publishedAt: '2026-08-11T09:00:00.000Z',
    author: { fullName: 'Fatima Hassan' },
  },
  {
    id: 'c1000000-0000-4000-8000-000000000003',
    type: 'blog_post',
    title: 'Cybersecurity Compliance Frameworks for SACCOs & Fintechs',
    excerpt:
      'Step-by-step regulatory readiness guide for Central Bank compliance and data protection.',
    slug: 'cybersecurity-compliance-frameworks-for-saccos-fintechs',
    slugPath: '/blog/cybersecurity-compliance-frameworks-for-saccos-fintechs',
    category: 'industry_updates',
    categoryLabel: 'Industry Updates',
    severity: 'medium',
    tags: ['compliance', 'sacco', 'fintech'],
    readMinutes: 8,
    featuredImageUrl: 'https://assets.vunvault.test/blog/compliance-frameworks.jpg',
    imageAlt: 'Compliance readiness guide',
    publishedAt: '2026-08-08T09:00:00.000Z',
    author: { fullName: 'Brian Otieno' },
  },
  {
    id: 'c1000000-0000-4000-8000-000000000004',
    type: 'blog_post',
    title: 'Zero-Day Exploit Trends: What 2026 Revealed About API Ingress',
    excerpt:
      'Correlating twelve months of weaponised CVEs to expose where attackers are concentrating next.',
    slug: 'zero-day-exploit-trends-what-2026-revealed-about-api-ingress',
    slugPath: '/blog/zero-day-exploit-trends-what-2026-revealed-about-api-ingress',
    category: 'threat_intel',
    categoryLabel: 'Threat Intel',
    severity: 'critical',
    tags: ['zero-day', 'api', 'cve'],
    readMinutes: 5,
    featuredImageUrl: 'https://assets.vunvault.test/blog/zero-day-trends.jpg',
    imageAlt: 'Zero-day exploit trend chart',
    publishedAt: '2026-08-05T09:00:00.000Z',
    author: { fullName: 'Fatima Hassan' },
  },
  {
    id: 'c1000000-0000-4000-8000-000000000005',
    type: 'blog_post',
    title: 'Ransomware Playbooks Now Targeting East African SACCOs',
    excerpt:
      'A forensic walkthrough of three real intrusion chains and the containment steps that worked.',
    slug: 'ransomware-playbooks-now-targeting-east-african-saccos',
    slugPath: '/blog/ransomware-playbooks-now-targeting-east-african-saccos',
    category: 'news',
    categoryLabel: 'News',
    severity: 'high',
    tags: ['ransomware', 'sacco', 'incident-response'],
    readMinutes: 9,
    featuredImageUrl: 'https://assets.vunvault.test/blog/ransomware-playbooks.jpg',
    imageAlt: 'Ransomware intrusion chain',
    publishedAt: '2026-08-02T09:00:00.000Z',
    author: { fullName: 'Amara Njoroge' },
  },
  {
    id: 'c1000000-0000-4000-8000-000000000006',
    type: 'blog_post',
    title: 'Inside the VUNVAULT Sensor Network: Catching Memory Exfiltration',
    excerpt:
      'How 412 distributed sensors correlate kernel-level telemetry to stop zero-day exfiltration in flight.',
    slug: 'inside-the-vunvault-sensor-network-catching-memory-exfiltration',
    slugPath: '/blog/inside-the-vunvault-sensor-network-catching-memory-exfiltration',
    category: 'blog',
    categoryLabel: 'Blog',
    severity: 'low',
    tags: ['sensor-network', 'engineering', 'exfiltration'],
    readMinutes: 6,
    featuredImageUrl: 'https://assets.vunvault.test/blog/sensor-network.jpg',
    imageAlt: 'Distributed sensor network',
    publishedAt: '2026-07-29T09:00:00.000Z',
    author: { fullName: 'Daniel Mwangi' },
  },
];

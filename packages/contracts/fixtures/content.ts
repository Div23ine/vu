import type { ModerationItem, ModerationSummary } from '../src/content.js';

/**
 * Content moderation fixtures.
 *
 * Titles, types, slugs, authors, submission times, risk flags and statuses are the
 * product's own data. The one-line summaries are fixture-only neutral descriptions
 * (the catalogue supplies no verbatim summary text for these items).
 *
 * Author ids and initials match `fixtures/users.ts` exactly — `contracts-b.test.ts`
 * asserts that cross-fixture consistency.
 */

const AUTHOR = {
  njoroge: {
    id: 'c0000000-0000-4000-8000-000000000002',
    fullName: 'Amara Njoroge',
    initials: 'AN',
    team: 'offensive_security',
  },
  hassan: {
    id: 'c0000000-0000-4000-8000-000000000004',
    fullName: 'Fatima Hassan',
    initials: 'FH',
    team: 'threat_intelligence',
  },
  otieno: {
    id: 'c0000000-0000-4000-8000-000000000005',
    fullName: 'Brian Otieno',
    initials: 'BO',
    team: 'curriculum_product',
  },
  wanjiru: {
    id: 'c0000000-0000-4000-8000-000000000006',
    fullName: 'Grace Wanjiru',
    initials: 'GW',
    team: 'compliance_comms',
  },
} as const;

export const moderationItems: ModerationItem[] = [
  {
    id: 'f0000000-0000-4000-8000-000000000001',
    title: 'Kenya State House Cyber Security Audit & Risk Analysis',
    summary:
      'An analysis of the reported State House cyber security audit and the risk findings attributed to it.',
    type: 'blog_post',
    slugPath: '/blog/kenya-state-house-cyber-audit',
    author: { ...AUTHOR.njoroge },
    submittedAt: '2026-09-24T08:12:00Z',
    riskFlags: ['legal_review_required', 'brand_sensitive'],
    status: 'pending_review',
    cveId: null,
  },
  {
    id: 'f0000000-0000-4000-8000-000000000002',
    title: 'Apache Struts 2 OGNL Injection — Emergency Client Advisory',
    summary:
      'Emergency advisory covering the OGNL injection vulnerability in Apache Struts 2, affected versions and mitigations.',
    type: 'threat_advisory',
    slugPath: '/advisories/cve-2026-21447',
    author: { ...AUTHOR.hassan },
    submittedAt: '2026-09-24T09:02:00Z',
    riskFlags: [],
    status: 'pending_review',
    cveId: 'CVE-2026-21447',
  },
  {
    id: 'f0000000-0000-4000-8000-000000000003',
    title: 'VUNVAULT Sentinel — Continuous Attack Surface Monitoring',
    summary:
      'Product listing describing continuous attack-surface monitoring coverage, alerting and reporting.',
    type: 'product_listing',
    slugPath: '/products/sentinel',
    author: { ...AUTHOR.otieno },
    submittedAt: '2026-09-23T16:48:00Z',
    riskFlags: ['unverified_claim'],
    status: 'changes_requested',
    cveId: null,
  },
  {
    id: 'f0000000-0000-4000-8000-000000000004',
    title: 'VUNVAULT Partners With East African Fintech Alliance',
    summary: 'Announcement of a partnership with a regional fintech alliance.',
    type: 'news_announcement',
    slugPath: '/news/east-african-fintech-alliance',
    author: { ...AUTHOR.wanjiru },
    submittedAt: '2026-09-23T11:30:00Z',
    riskFlags: [],
    status: 'in_review',
    cveId: null,
  },
  {
    id: 'f0000000-0000-4000-8000-000000000005',
    title: "Africa's Cyber Awakening: How the Continent Is Fighting Back",
    summary:
      'An overview of cyber defence investment, skills and incident-response capacity across the continent.',
    type: 'blog_post',
    slugPath: '/blog/africa-cyber-awakening',
    author: { ...AUTHOR.njoroge },
    submittedAt: '2026-09-22T14:20:00Z',
    riskFlags: ['unverified_claim'],
    status: 'rejected',
    cveId: null,
  },
  {
    id: 'f0000000-0000-4000-8000-000000000006',
    title: 'VUNVAULT Opens Regional Security Operations Hub in Accra',
    summary: 'Announcement of a new regional security operations hub in Accra.',
    type: 'news_announcement',
    slugPath: '/news/accra-soc-hub',
    author: { ...AUTHOR.wanjiru },
    submittedAt: '2026-09-21T10:15:00Z',
    riskFlags: [],
    status: 'approved',
    cveId: null,
  },
];

export const moderationSummary: ModerationSummary = {
  awaitingReview: 14,
  changesRequested: 5,
  approvedToday: 9,
  rejectedLast7Days: 3,
  avgReviewHours: 2.4,
  publishedLast30Days: 62,
};

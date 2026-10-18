import type { UsdCents } from '@vunvault/lib';

/**
 * Plans & Pricing constants .
 *
 * USD only — these amounts equal the seeded `plans` rows in the database and
 * are DISPLAY-ONLY here: the marketing sections never charge. A future
 * `GET /api/v1/plans` may replace this file; until then the codes below are
 * the join key to the seeded rows (`starter_scan`, `sacco_fintech_compliance`,
 * `enterprise_retainer`).
 */

export interface Plan {
  code: 'starter_scan' | 'sacco_fintech_compliance' | 'enterprise_retainer';
  name: string;
  tag?: string;
  priceUsdCents: UsdCents;
  unit: 'scan' | 'assessment' | 'month';
  description: string;
  features: string[];
  featured?: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    code: 'starter_scan',
    name: 'Small Business / Starter',
    tag: 'Starter',
    priceUsdCents: 29_900,
    unit: 'scan',
    description:
      'Affordable starter vulnerability scans with clear, actionable executive reporting.',
    features: [
      'External IP & domain enumeration',
      'Port & SSL vulnerability check',
      'Executive summary + remediation checklist',
    ],
  },
  {
    code: 'sacco_fintech_compliance',
    name: 'SACCO & Fintech Compliance',
    tag: 'Recommended',
    priceUsdCents: 89_900,
    unit: 'assessment',
    description:
      'Regulation-aware testing for financial institutions, M-Pesa gateways and Central Bank readiness.',
    features: [
      'Full external & API gateway assessment',
      'Central Bank regulatory audit mapping',
      'Mobile app & M-Pesa security check',
    ],
    featured: true,
  },
  {
    code: 'enterprise_retainer',
    name: 'IT / Enterprise Retainer',
    tag: 'Retainer',
    priceUsdCents: 249_900,
    unit: 'month',
    description: 'Full-scope retainer testing, continuous red teaming and board-ready reporting.',
    features: [
      '24/7 attack surface monitoring',
      'Quarterly penetration testing',
      'Dedicated security architect',
    ],
  },
];

export const PLANS_FOOTNOTE =
  'All plans include a named engagement lead, encrypted report delivery and a post-remediation re-test window.';

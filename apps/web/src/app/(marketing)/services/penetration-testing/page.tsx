import type { Metadata } from 'next';
import { JsonLd } from '../../../../lib/json-ld';
import { SITE_NAME, breadcrumbJsonLd, serviceJsonLd } from '../../../../lib/seo';
import { ServicePage, type ServicePageContent } from '../_components/service-page';

export const metadata: Metadata = {
  alternates: { canonical: '/services/penetration-testing' },
  title: 'Penetration Testing',
  description:
    'Scoped penetration testing of web applications, APIs and network perimeters, mapped to OWASP ASVS and NIST SP 800-115, with a redacted sample report.',
};

const CONTENT: ServicePageContent = {
  eyebrow: 'Service · Offensive Security',
  title: 'Penetration testing that survives peer review',
  intro:
    'A time-boxed, authorised attack on the systems you name in the scope — run by a named lead analyst, validated finding by finding, and reported in language your board and your developers can both act on.',
  scope: [
    {
      area: 'Web applications',
      detail:
        'Authentication, session handling, authorisation, injection, business-logic abuse — tested against OWASP ASVS level 2.',
    },
    {
      area: 'APIs & gateways',
      detail:
        'Object-level authorisation, mass assignment, rate limits, token lifecycles and callback validation.',
    },
    {
      area: 'Network perimeter',
      detail:
        'Scoped enumeration and service analysis of the ranges you authorise — never anything outside the signed scope.',
    },
    {
      area: 'Client-side controls',
      detail: 'XSS, CSRF, clickjacking, DOM sinks and storage hygiene in the browser.',
    },
  ],
  deliverables: [
    'Findings register with severity, evidence and step-by-step reproduction',
    'Developer-ready remediation guidance per finding',
    'Executive summary written for non-technical readers',
    'Closing call with the lead analyst',
    'One re-test window within 30 days of the report',
  ],
  timeline:
    'Scoping 2–3 days; fieldwork 5–10 business days depending on scope; report 3 business days after fieldwork.',
  frameworks: [
    'OWASP Application Security Verification Standard (ASVS) v4, level 2',
    'NIST SP 800-115 testing methodology',
    'OWASP Top 10 as the board-level reporting lens',
  ],
  finding: {
    id: 'VV-2026-014',
    title: 'Broken object-level authorisation on a statement download endpoint',
    severity: 'High',
    body: 'Swapping a statement identifier between two test accounts returned the other account’s document. Reproduced deterministically with both accounts; no privilege escalation beyond read was found. Remediation added a server-side ownership check; the day-9 re-test ran the same cases and passed.',
  },
  planCode: 'starter_scan',
  cta: 'Book a penetration test',
};

export default function PenetrationTestingPage() {
  return (
    <>
      {/* `Service` + `BreadcrumbList`: the page is the offer, the graph is what
          an answer engine reads to attribute it to this organisation. */}
      <JsonLd data={serviceJsonLd('/services/penetration-testing')} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: '/' },
          { name: 'Services', path: '/services' },
        ])}
      />
      <ServicePage content={CONTENT} />
    </>
  );
}

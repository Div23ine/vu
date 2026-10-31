import type { Metadata } from 'next';
import { JsonLd } from '../../../../lib/json-ld';
import { SITE_NAME, breadcrumbJsonLd, serviceJsonLd } from '../../../../lib/seo';
import { ServicePage, type ServicePageContent } from '../_components/service-page';

export const metadata: Metadata = {
  alternates: { canonical: '/services/sacco-compliance' },
  title: 'SACCO & Fintech Compliance Assessment',
  description:
    'Control mapping and gap assessment for SACCOs and fintechs against CBK and SASRA cyber risk guidance and the Kenya Data Protection Act 2019.',
};

const CONTENT: ServicePageContent = {
  eyebrow: 'Service · Compliance',
  title: 'SACCO & fintech compliance, evidenced not asserted',
  intro:
    'We map your live configuration and written controls against the expectations of your regulators, then hand you the evidence pack an auditor can ingest without translation.',
  scope: [
    {
      area: 'Governance & policy',
      detail:
        'Cyber risk policies, committee cadence, incident plans — reviewed against regulator expectations.',
    },
    {
      area: 'Technical controls',
      detail:
        'Configuration review of the controls your policies promise: access, logging, segmentation, backup.',
    },
    {
      area: 'Data protection',
      detail:
        'Kenya DPA 2019 assessment: lawful bases, retention, data-subject request handling, processor contracts.',
    },
    {
      area: 'Evidence collection',
      detail: 'What to export, what to screenshot and what to fix before the audit window opens.',
    },
  ],
  deliverables: [
    'Control matrix mapped line-by-line to the applicable guidance',
    'Gap register with owners, severities and deadlines',
    'Audit-ready evidence pack',
    'Remediation roadmap your board can track',
  ],
  timeline: 'Two to three weeks, driven by evidence availability on your side.',
  frameworks: [
    'CBK Cyber Risk Management guidance for regulated institutions',
    'SASRA prudential and governance guidelines for SACCOs',
    'Kenya Data Protection Act, 2019 and ODPC guidance',
    'ISO/IEC 27001 Annex A as the cross-walk for multinational boards',
  ],
  finding: {
    id: 'VV-2026-021',
    title: 'Audit-log retention below supervisory expectation',
    severity: 'Medium',
    body: 'Application audit logs rolled over at 30 days while the institution’s own policy and supervisory expectation required twelve months. Remediation extended retention and added a write-once daily export; the evidence pack now shows 13 months of continuous logs.',
  },
  planCode: 'sacco_fintech_compliance',
  cta: 'Book the compliance assessment',
};

export default function SaccoCompliancePage() {
  return (
    <>
      {/* `Service` + `BreadcrumbList`: the page is the offer, the graph is what
          an answer engine reads to attribute it to this organisation. */}
      <JsonLd data={serviceJsonLd('/services/sacco-compliance')} />
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

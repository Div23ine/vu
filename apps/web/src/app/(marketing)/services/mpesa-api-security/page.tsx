import type { Metadata } from 'next';
import { ServicePage, type ServicePageContent } from '../_components/service-page';

export const metadata: Metadata = {
  title: 'M-Pesa & API Security',
  description:
    'Security review of M-Pesa Daraja integrations and payment APIs: callbacks, credentials, personal data in payment payloads, and telco-side fraud controls.',
};

const CONTENT: ServicePageContent = {
  eyebrow: 'Service · Payments Security',
  title: 'M-Pesa & payment API security review',
  intro:
    'Payment integrations fail in predictable places: unsigned callbacks, shared secrets, and personal data riding in payment payloads. We test yours the way an attacker would — inside a signed scope.',
  scope: [
    {
      area: 'Daraja integration',
      detail:
        'C2B / B2C / STK push flows, timeout handling and reconciliation against telco records.',
    },
    {
      area: 'Callback integrity',
      detail: 'Signature and origin validation, replay behaviour, and what your backend trusts.',
    },
    {
      area: 'Credential handling',
      detail: 'Where API keys and passphrases live, rotate and leak — in code, configs and logs.',
    },
    {
      area: 'Personal data in payloads',
      detail: 'Kenya DPA 2019 review of what payment traffic carries, stores and retains.',
    },
  ],
  deliverables: [
    'Integration findings with reproduction steps',
    'Callback hardening guide for your developers',
    'Secret rotation and storage plan',
    'Re-test of every fixed finding',
  ],
  timeline:
    'One to two weeks of fieldwork for a single integration; two to three for multi-service payment stacks.',
  frameworks: [
    'Safaricom M-Pesa integration guidelines as published',
    'Kenya Data Protection Act, 2019',
    'PCI DSS scoping guidance where card data touches the same flow',
    'OWASP API Security Top 10',
  ],
  finding: {
    id: 'VV-2026-009',
    title: 'Unsigned payment callback accepted by the confirmation endpoint',
    severity: 'Critical',
    body: 'The confirmation endpoint accepted a crafted callback with no signature or origin check, marking an unpaid order as paid. Demonstrated against a staging integration with written authorisation; remediation enforced signature validation and telco-origin allow-listing, verified by re-test.',
  },
  planCode: 'starter_scan',
  cta: 'Book the payments security review',
};

export default function MpesaApiSecurityPage() {
  return <ServicePage content={CONTENT} />;
}

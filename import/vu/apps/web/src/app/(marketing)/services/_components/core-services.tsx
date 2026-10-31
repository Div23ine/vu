import { ClipboardCheck, Cloud, Globe, Radar, Shield, Wrench } from 'lucide-react';
import '../_styles/services.css';

/**
 * Core Services — the six-card grid. Server component; titles,
 * bodies and tag chips verbatim from the design (the `vv-skill` chip style
 * ships in `services.css` so this page does not depend on the About sheet).
 */

const SERVICES = [
  {
    title: 'Web Application Penetration Testing',
    text: 'Manual testing across the OWASP Top 10 — injection, authentication and session flaws, broken access control, SSRF and insecure deserialisation — plus targeted parameter fuzzing and business-logic abuse that scanners never reach.',
    tags: ['OWASP Top 10', 'Parameter Fuzzing', 'Broken Access Control'],
    Icon: Globe,
  },
  {
    title: 'Attack Surface Reconnaissance',
    text: 'Subdomain enumeration, certificate-transparency mining, SSL/TLS certificate tracing and service fingerprinting — surfacing the shadow IT, forgotten staging hosts and unmanaged APIs that quietly widen your perimeter.',
    tags: ['Subdomain Enumeration', 'CT Logs', 'Shadow IT'],
    Icon: Radar,
  },
  {
    title: 'WAF & Defense Verification',
    text: 'We attack your defences the way an adversary would: rule-evasion encoding, rate-limit and anti-automation validation, payload stress testing and bypass chains that prove whether your WAF, CDN or bot-management layer actually blocks what it claims to.',
    tags: ['Rule Evasion', 'Rate Limiting', 'Payload Stress'],
    Icon: Shield,
  },
  {
    title: 'IT & Network Troubleshooting',
    text: 'When something is broken and nobody can explain why: DNS diagnostics, record-consistency audits, connectivity tracing, MTU and routing faults, firewall rule review and misconfiguration hunting across hybrid estates.',
    tags: ['DNS Diagnostics', 'Connectivity', 'Firewall Checks'],
    Icon: Wrench,
  },
  {
    title: 'Cloud & Mobile Security',
    text: 'API gateway configuration reviews, cloud IAM and storage exposure checks, mobile application testing (Android & iOS) and dedicated M-Pesa / fintech integration audits covering callback validation, replay protection and settlement integrity.',
    tags: ['API Gateway', 'M-Pesa / Fintech', 'Mobile App Tests'],
    Icon: Cloud,
  },
  {
    title: 'Compliance & Reporting',
    text: 'Executive briefing decks for the board, developer-ready technical remediation guides for the engineering team, and audit evidence packs mapped to GDPR, ISO 27001, ODPC and Central Bank supervisory requirements.',
    tags: ['Executive Briefing', 'Remediation Guide', 'Audit Evidence'],
    Icon: ClipboardCheck,
  },
] as const;

export function CoreServices() {
  return (
    <section id="core-services" className="vv-svc-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="vv-kicker">Core Security Services</span>
          <h2 className="vv-section-title">Everything we test, and why it matters</h2>
          <p className="vv-section-lede">
            Each engagement is scoped, executed and reported by a named lead analyst — never a fully
            automated scan dressed up as an assessment.
          </p>
        </div>

        <div className="vv-svc-grid">
          {SERVICES.map((service) => (
            <article key={service.title} className="vv-svc-card">
              <span className="vv-svc-icon" aria-hidden="true">
                <service.Icon size={22} />
              </span>
              <h3 className="vv-svc-title">{service.title}</h3>
              <p className="vv-svc-text">{service.text}</p>
              <div className="vv-svc-tags">
                {service.tags.map((tag) => (
                  <span key={tag} className="vv-skill">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

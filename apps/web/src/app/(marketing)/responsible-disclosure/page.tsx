import type { Metadata } from 'next';
import { LegalDoc, LegalSection } from '../_components/legal-doc';

export const metadata: Metadata = {
  title: 'Responsible Disclosure',
  description:
    'VUNVAULT’s coordinated vulnerability disclosure policy: scope, safe harbour, timelines and the PGP channel, aligned with ISO/IEC 29147 and 30111.',
};

const UPDATED = '17 October 2026';
const VERSION = '2.0';

export default function ResponsibleDisclosurePage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Responsible Disclosure"
      updated={UPDATED}
      version={VERSION}
      intro={
        <p>
          We build security tooling, so we hold ourselves to the standard we sell: coordinated
          vulnerability disclosure per ISO/IEC 29147:2020 and ISO/IEC 30111:2019, and the CERT/CC
          CVD guide. If you find a weakness in anything we operate, this page is the contract
          between us.
        </p>
      }
    >
      <LegalSection id="scope" title="1. In scope">
        <ul>
          <li>
            <code>vunvault.com</code> and its subdomains, including the marketing site and the
            client portal;
          </li>
          <li>
            the public API behind <code>/api/v1</code>;
          </li>
          <li>our published feeds and download artifacts.</li>
        </ul>
        <p>
          Out of scope: social engineering of staff, physical attacks, denial of service, bulk data
          extraction, and any system we do not operate — including customer systems, which are
          covered by their own rules of engagement. If you are unsure whether something is in scope,
          ask before you probe.
        </p>
      </LegalSection>

      <LegalSection id="rules" title="2. What we ask of you">
        <ul>
          <li>
            a minimal, targeted proof of concept — enough to demonstrate impact, never a full data
            dump;
          </li>
          <li>no access to, or copying of, personal data beyond the minimum needed;</li>
          <li>
            no chaining into lateral movement, persistence or privilege escalation beyond the single
            issue;
          </li>
          <li>
            give us a reasonable window (we propose 90 days from acknowledgement) before public
            disclosure, and coordinate the announcement with us;
          </li>
          <li>report privately, as below — not in a public issue tracker or thread.</li>
        </ul>
      </LegalSection>

      <LegalSection id="safe-harbour" title="3. What we promise you">
        <ul>
          <li>
            <strong>Safe harbour:</strong> research conducted in good faith under this policy is
            authorised. We will not initiate legal action against you, and if a third party pursues
            you for in-policy research we will state, in writing, that the work was authorised under
            this policy.
          </li>
          <li>
            <strong>Acknowledgement within 2 business days</strong>, triage within 7, and a
            remediation plan within 30 for anything we accept.
          </li>
          <li>
            <strong>Credit</strong> in the published advisory (or anonymity, your choice), and a
            written thank-you you can show an employer.
          </li>
          <li>
            <strong>No bounty programme at present:</strong> we are a young firm; recognition and
            coordination are what we can offer honestly today. If that changes, this page says so
            first.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="channel" title="4. How to report">
        <p>
          Email <code>info@vunvault.com</code> with the category “Vulnerability / Bug Report”, or
          write to the same address and encrypt to our PGP key, published at{' '}
          <code>/vunvault-pgp.asc</code>, fingerprint <code>3B99 FC12 8A4D 55E0 91C7</code>.
          Include: the affected endpoint, reproduction steps, impact, and any evidence (screenshots,
          minimal HTTP transcripts). Do not include other people’s personal data in the report.
        </p>
      </LegalSection>

      <LegalSection id="coordination" title="5. Coordination with authorities">
        <p>
          Where a finding implicates systems beyond ours, we coordinate with the relevant bodies —
          the National CERT (Kenya), the Australian Cyber Security Centre, CERT-EU or the relevant
          national CSIRT — before publication, and we credit researchers in any joint advisory they
          issue, unless you prefer otherwise.
        </p>
      </LegalSection>

      <p className="vv-legal-note">
        Found something in a client system through our report? That is the client’s disclosure
        process, guided by our rules of engagement — this page covers VUNVAULT’s own estate only.
      </p>
    </LegalDoc>
  );
}

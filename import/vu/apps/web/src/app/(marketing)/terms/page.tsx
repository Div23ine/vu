import type { Metadata } from 'next';
import { LegalDoc, LegalSection, LegalSub } from '../_components/legal-doc';

export const metadata: Metadata = {
  alternates: { canonical: '/terms' },
  title: 'Terms of Service',
  description:
    'The agreement governing use of the VUNVAULT website, portal and published tooling, with consumer protections under EU, UK, Australian and Kenyan law.',
};

const UPDATED = '17 October 2026';
const VERSION = '2.0';

export default function TermsOfServicePage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms of Service"
      updated={UPDATED}
      version={VERSION}
      intro={
        <p>
          These terms govern your use of the VUNVAULT website, the client portal and the free
          tooling we publish. Engagements (penetration tests, assessments, retainers) are
          additionally governed by a signed scope and rules-of-engagement document, which prevails
          over these terms where the two conflict.
        </p>
      }
    >
      <LegalSection id="contract" title="1. How a contract is formed">
        <p>
          Browsing this site creates no contract. A services contract is formed only when we issue a
          written scope and rules of engagement and you countersign it (or accept it in the portal).
          Quotes are valid for 30 days. These terms apply to every engagement unless the signed
          scope says otherwise in writing.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="2. Acceptable use">
        <p>You agree not to, and not to help others to:</p>
        <ul>
          <li>
            scan, probe, test or attack any system you do not own or have written permission to
            assess — including with our tools; authorisation is your responsibility and unauthorised
            access is a crime under, among others, the Computer Misuse and Cybercrimes Act, 2018
            (Kenya), the Computer Misuse Act 1990 (UK), Directive 2013/40/EU and Part 10.7 of the
            Criminal Code Act 1995 (Cth) (Australia);
          </li>
          <li>
            abuse the public forms, waitlists or newsletter (bulk submissions, list pollution,
            mail-bombing);
          </li>
          <li>
            resell, rent or offer our reports, tooling or feed data as a service without a written
            licence;
          </li>
          <li>interfere with, reverse-engineer or bypass the platform’s security controls.</li>
        </ul>
        <p>
          We may suspend access, rate-limit or terminate accounts that breach this section, and we
          report credible threats to life or critical infrastructure to the relevant authority.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Accounts and security">
        <p>
          Portal accounts require accurate registration data. You are responsible for your
          credentials and for enabling MFA where offered. Session tokens live in HttpOnly cookies
          and expire per the Cookie Policy; tell us immediately at <code>support@vunvault.com</code>{' '}
          if you suspect account misuse.
        </p>
      </LegalSection>

      <LegalSection id="tooling" title="4. Free tooling licence">
        <p>
          Free resources (CLIs, checklists, feeds, cheatsheets) are provided under a non-exclusive,
          non-transferable, revocable licence to use them for authorised security work on systems
          you own or are contracted to assess. They are provided “as-is” (see §8); feeds may change
          format with reasonable notice where practical. Attribution is appreciated, never required.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="5. Intellectual property and deliverables">
        <ul>
          <li>
            The platform, its code, design and published content remain VUNVAULT’s property (or our
            licensors’), except for the open tooling licence in §4.
          </li>
          <li>
            On full payment, ownership of the engagement report and its findings transfers to you,
            including the right to share it with your regulator, auditor and insurers under
            confidentiality.
          </li>
          <li>
            We retain anonymised, aggregate learnings (technique classes, not your data) to improve
            our methods — never client-identifying material.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="client-duties" title="6. Your responsibilities">
        <p>
          You warrant that you hold the authorisations needed for every system in scope, that scope
          lists are accurate, and that third-party systems in scope are covered by written
          permission from their owner. You will provide a technical contact during testing and a
          backup of anything you cannot afford to lose — testing can break things, which is the
          point of finding out before an attacker does.
        </p>
      </LegalSection>

      <LegalSection id="fees" title="7. Fees and payment">
        <p>
          Fees are quoted in USD, invoiced per the scope (typically 50% at kickoff, 50% at
          delivery), payable within 14 days. Late payments accrue interest where lawful. Taxes and
          levies required by your jurisdiction are yours; Kenyan taxes on our side are ours.
        </p>
      </LegalSection>

      <LegalSection id="warranties" title="8. Warranties, disclaimers and liability">
        <LegalSub title="8.1 The promise we make">
          <p>
            Services are performed with the care and skill reasonably expected of a professional
            security firm, by staff with the credentials advertised. In Australia this matches the
            guarantee under s 60 of the Australian Consumer Law (ACL), which cannot be excluded; in
            the EU/UK it sits alongside your statutory consumer rights; in Kenya alongside the
            Consumer Protection Act, 2012.
          </p>
        </LegalSub>
        <LegalSub title="8.2 What we do not promise">
          <p>
            A clean report is not a guarantee of security: testing samples a system at a point in
            time. Outside the signed scope, and to the extent the law allows, the site and free
            tooling are provided without warranties of any kind, and we do not warrant uninterrupted
            or error-free operation.
          </p>
        </LegalSub>
        <LegalSub title="8.3 Liability cap and exclusions">
          <p>
            To the maximum extent permitted by law, our total liability arising out of or relating
            to these terms or an engagement is limited to the fees paid or payable for the
            engagement (or KES 100,000 for free tooling and site use), and neither party is liable
            for indirect or consequential loss. Nothing in these terms limits liability for death or
            personal injury caused by negligence, fraud, or any other liability that cannot be
            limited (ACL s 64; Directive 93/13/EEC on unfair terms; s. 9 Consumer Protection Act,
            2012 Kenya).
          </p>
        </LegalSub>
      </LegalSection>

      <LegalSection id="termination" title="9. Term, suspension and termination">
        <p>
          Either party may end an engagement for material breach not cured within 14 days of notice.
          We may suspend portal access immediately on a credible security risk. Sections 5, 8, 10
          and 11 survive termination.
        </p>
      </LegalSection>

      <LegalSection id="law" title="10. Governing law and disputes">
        <p>
          These terms are governed by the laws of Kenya, and the courts of Nairobi have jurisdiction
          — except where your consumer rights say otherwise: EU/EEA consumers keep the protection of
          their home law (Art. 6 Regulation (EC) 593/2008, Rome I) and may sue at home; UK consumers
          keep UK mandatory protections; Australian consumers keep the ACL and may rely on it in
          Australian courts. We will first try to resolve any dispute in good faith within 30 days
          of written notice before either side files anything.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to these terms">
        <p>
          Material changes bump the policy version carried by the consent cookie, which brings the
          banner back on your next visit, and are dated at the top of this page. Continued use of
          the portal after a change takes effect is acceptance for engaged services only where the
          signed scope allows it; otherwise the signed scope governs.
        </p>
      </LegalSection>

      <p className="vv-legal-note">
        Licensing, procurement or legal-review questions: <code>info@vunvault.com</code>.
      </p>
    </LegalDoc>
  );
}

import type { Metadata } from 'next';
import { LegalDoc, LegalSection } from '../_components/legal-doc';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'Every cookie VUNVAULT sets, why it exists, how long it lives, and how to change or withdraw your choice under the ePrivacy Directive, GDPR and APPs.',
};

const UPDATED = '17 October 2026';
const VERSION = '2.0';

export default function CookiePolicyPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Cookie Policy"
      updated={UPDATED}
      version={VERSION}
      intro={
        <p>
          This site sets a small number of first-party cookies and nothing else: no third-party
          advertising cookies, no cross-site trackers, no fingerprinting. Where the law requires
          consent for a cookie — the EU/EEA and UK under Art. 5(3) of the ePrivacy Directive
          (2002/58/EC) and PECR, Kenya under the Data Protection Act, 2019, and Australia under APP
          1 and APP 11 transparency — we ask before setting it.
        </p>
      }
    >
      <LegalSection id="how-consent-works" title="1. How consent works here">
        <p>
          On your first visit a banner offers three choices: accept all, essential only, or
          customise category by category (Analytics, Marketing, Functional). Your choice is stored
          in the <code>vv_consent</code> cookie together with the policy version you agreed to. The
          banner returns only if you have never chosen, or if the policy version has moved on since
          your choice — that is how a material change to this page or the Privacy Policy reaches
          you. Refusing non-essential cookies never degrades the site: v1 ships no analytics or
          marketing scripts at all, so “essential only” loses you nothing today.
        </p>
        <p>
          To change your mind, delete the <code>vv_consent</code> cookie in your browser (the banner
          returns on your next page load) or email <code>privacy@vunvault.com</code>. Strictly
          necessary cookies do not need consent and cannot be switched off; they are listed below so
          you always know what is on your device.
        </p>
      </LegalSection>

      <LegalSection id="table" title="2. The complete cookie table">
        <table className="vv-legal-table">
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Category</th>
              <th>Lifetime</th>
              <th>HttpOnly</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>vv_consent</code>
              </td>
              <td>
                Records your cookie choice and the policy version you agreed to, so we do not re-ask
                until something material changes.
              </td>
              <td>Strictly necessary</td>
              <td>12 months</td>
              <td>No (the banner reads it before first paint)</td>
            </tr>
            <tr>
              <td>
                <code>vv_anon</code>
              </td>
              <td>
                A random identifier for visitors without an account, so a consent decision follows
                you across pages without identifying you.
              </td>
              <td>Strictly necessary</td>
              <td>12 months</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>vv_at</code>
              </td>
              <td>Short-lived portal session access token (signed-in users only).</td>
              <td>Strictly necessary</td>
              <td>60 minutes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>vv_rt</code>
              </td>
              <td>Portal refresh token; session-length unless you tick “remember this device”.</td>
              <td>Strictly necessary</td>
              <td>Session, or 30 days with “remember”</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>vv_mfa</code>
              </td>
              <td>Holds an in-progress multi-factor challenge for five minutes.</td>
              <td>Strictly necessary</td>
              <td>5 minutes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>vv_csrf</code>
              </td>
              <td>
                Double-submit CSRF token pairing your browser with your session; readable by script
                by design so the check works.
              </td>
              <td>Strictly necessary</td>
              <td>Session</td>
              <td>No</td>
            </tr>
          </tbody>
        </table>
        <p>
          All cookies are first-party, <code>SameSite=Lax</code> or <code>Strict</code>, and
          <code>Secure</code> outside local development. None of them carries an advertising or
          tracking identifier, and none is shared with third parties except where the Privacy
          Policy’s transfer section applies to the platform as a whole.
        </p>
      </LegalSection>

      <LegalSection id="categories" title="3. The categories the banner offers">
        <p>
          <strong>Strictly necessary</strong> — the six cookies above; without them the site cannot
          keep a session or remember your choice (no consent required, ePrivacy recitals and
          ICO/EDPB guidance). <strong>Analytics</strong> — aggregated, anonymised measurement of
          which pages and tools are actually used; currently no script implements it.{' '}
          <strong>Marketing</strong> — campaign measurement and suppression of repeat briefings;
          likewise unimplemented today. <strong>Functional</strong> — interface memory such as theme
          or collapsed panels; held in memory only, never in storage. Accepting a category today is
          permission for the future, not a switch that turns something on tonight.
        </p>
      </LegalSection>

      <LegalSection id="controls" title="4. Your browser’s own controls">
        <p>
          Every mainstream browser lets you view, block and delete cookies (Chrome, Edge, Firefox
          and Safari ship the controls under Privacy &amp; Security settings). Blocking all cookies
          will sign you out of the portal on every visit and re-show the banner, because the choice
          itself is a cookie — that is expected, not a fault.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="5. Changes">
        <p>
          Adding a cookie, a purpose or a third party is a material change: the policy version
          bumps, stored older decisions stop matching, and the banner asks you again. The table
          above is generated from the same constants the platform ships, so what you read is what is
          set.
        </p>
      </LegalSection>

      <p className="vv-legal-note">
        Cookie questions: <code>privacy@vunvault.com</code>.
      </p>
    </LegalDoc>
  );
}

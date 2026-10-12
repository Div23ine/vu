import {
  Building2,
  Download,
  Mail,
  MessageCircle,
  Newspaper,
  Rss,
  ShieldAlert,
} from 'lucide-react';
import '../_styles/contact.css';

/**
 * Contact side cards (Task 57) — the `#direct-channels` column: email and
 * WhatsApp channels, the whistleblower/PGP card, Follow & Engage, the
 * six-step press workflow and operational info. Copy verbatim; the PGP file
 * link points at `/vunvault-pgp.asc` — a static asset the OPERATOR adds under
 * `public/` (the catalogue: do not create it).
 *
 * The press-workflow steps mention the prototype's `user-management.html` /
 * `admin.html` as inline text (kept verbatim as copy — they are not links;
 * "do not copy href values such as *.html").
 */

const PRESS_STEPS = [
  {
    n: '01',
    body: (
      <>
        Submit a <strong>Journalist / Blogger Profile Request</strong> using the form.
      </>
    ),
  },
  {
    n: '02',
    body: (
      <>
        The request is routed to <code>user-management.html</code> for manual identity verification.
      </>
    ),
  },
  {
    n: '03',
    body: <>On approval, your account is upgraded to an authorised Journalist / Blogger profile.</>,
  },
  {
    n: '04',
    body: (
      <>
        Draft posts with embedded images or video and click <strong>Publish</strong>.
      </>
    ),
  },
  {
    n: '05',
    body: (
      <>
        Posts enter the moderation queue in <code>admin.html</code> — nothing goes live immediately.
      </>
    ),
  },
  {
    n: '06',
    body: <>Once an admin approves, the article publishes to the blog and dynamic feeds.</>,
  },
] as const;

const OPERATIONAL_INFO = [
  { label: 'Based in', value: 'Nairobi, Kenya' },
  { label: 'Coverage', value: 'Africa & worldwide' },
  { label: 'Support hours', value: 'Mon–Fri · 08:00–18:00 EAT' },
  { label: 'Incident response', value: '24 / 7 escalation line' },
] as const;

export function ContactCards() {
  return (
    <div id="direct-channels" className="space-y-5">
      <a
        href="mailto:support@vunvault.com"
        className="vv-channel glass-card border border-neutral-200/90"
      >
        <span className="vv-channel-icon" aria-hidden="true">
          <Mail size={20} />
        </span>
        <span className="min-w-0">
          <span className="vv-channel-label">Email Support</span>
          <span className="vv-channel-value">support@vunvault.com</span>
          <span className="vv-channel-text">
            General enquiries, scoping calls and assessment scheduling. Typical first response
            within one business day.
          </span>
        </span>
      </a>

      <a
        href="https://wa.me/254705998032"
        target="_blank"
        rel="noopener noreferrer"
        className="vv-channel glass-card border border-neutral-200/90"
      >
        <span className="vv-channel-icon" aria-hidden="true">
          <MessageCircle size={20} />
        </span>
        <span className="min-w-0">
          <span className="vv-channel-label">WhatsApp</span>
          <span className="vv-channel-value">+254 705 998 032</span>
          <span className="vv-channel-text">
            Urgent incident response and active-breach escalation, monitored during Nairobi business
            hours.
          </span>
        </span>
      </a>

      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-neutral-200/90">
        <div className="flex items-start gap-4">
          <span className="vv-channel-icon vv-channel-icon--dark" aria-hidden="true">
            <ShieldAlert size={20} />
          </span>
          <div className="min-w-0">
            <span className="vv-channel-label">Whistleblower &amp; Security</span>
            <h3 className="mt-1 text-lg font-extrabold text-neutral-900 tracking-tight">
              Confidential tip submission
            </h3>
          </div>
        </div>
        <p className="vv-channel-text">
          Report a data breach, insider threat or systemic control failure. Encrypt your message
          with our public PGP key before sending, and we will never disclose your identity without
          explicit consent or a lawful order.
        </p>
        <div className="vv-pgp">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Public PGP Key
            </div>
            <code>0x3B99FC12</code>
          </div>
          <a className="vv-pgp-dl" href="/vunvault-pgp.asc" download>
            <Download size={13} aria-hidden="true" />
            <span>Download key</span>
          </a>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
          Fingerprint: <code className="font-mono text-neutral-700">3B99 FC12 8A4D 55E0 91C7</code>
        </p>
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-neutral-200/90">
        <div className="flex items-start gap-4">
          <span className="vv-channel-icon vv-channel-icon--dark" aria-hidden="true">
            <Rss size={20} />
          </span>
          <div className="min-w-0">
            <span className="vv-channel-label">Follow &amp; Engage</span>
            <p className="vv-channel-text">
              Threat briefings, zero-day commentary and open-source tooling.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-neutral-200/90">
        <div className="flex items-start gap-4">
          <span className="vv-channel-icon vv-channel-icon--dark" aria-hidden="true">
            <Newspaper size={20} />
          </span>
          <div className="min-w-0">
            <span className="vv-channel-label">Press &amp; Publishing Workflow</span>
          </div>
        </div>
        <ol className="vv-steps">
          {PRESS_STEPS.map((step) => (
            <li key={step.n}>
              <span className="vv-steps-num">{step.n}</span>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-7 border border-neutral-200/90">
        <div className="flex items-start gap-4">
          <span className="vv-channel-icon vv-channel-icon--dark" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <div className="min-w-0">
            <span className="vv-channel-label">Operational Info</span>
          </div>
        </div>
        <dl className="vv-ops">
          {OPERATIONAL_INFO.map((row) => (
            <div key={row.label} className="vv-ops-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

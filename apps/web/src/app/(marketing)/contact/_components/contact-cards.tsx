import { Building2, Download, Mail, MessageCircle, Rss, ShieldAlert } from 'lucide-react';
import '../_styles/contact.css';

/**
 * Contact side cards — the `#direct-channels` column: email and WhatsApp
 * channels, the whistleblower/PGP card, Follow & Engage and operational info.
 * The PGP file link points at `/vunvault-pgp.asc` — a static asset the
 * OPERATOR adds under `public/`.
 */

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

import { Github, Linkedin, Mail, MapPin, MessageCircle, Twitter } from 'lucide-react';
import '../../_styles/home-end.css';

/**
 * Contact & Partnerships strip .
 *
 * Destinations verbatim from the design: WhatsApp deep link, the mailto
 * (displayed address `info@vunvault.com`, href `mailto:support@vunvault.com`
 * — exactly as the design markup has it) and the Nairobi line. Socials:
 * the X link is the one the home markup records; GitHub and LinkedIn use the
 * company URLs the spec records on the About page . The
 * design's fourth icon-only sibling has no recorded destination anywhere
 * in the spec and is therefore omitted rather than invented.
 */

const SOCIALS = [
  {
    href: 'https://x.com/vunvault',
    label: 'VUNVAULT on X (Twitter)',
    Icon: Twitter,
  },
  {
    href: 'https://github.com/vunvault',
    label: 'VUNVAULT on GitHub',
    Icon: Github,
  },
  {
    href: 'https://www.linkedin.com/company/vunvault',
    label: 'VUNVAULT on LinkedIn',
    Icon: Linkedin,
  },
] as const;

export function ContactStrip() {
  return (
    <section id="contact" className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Contact &amp; Partnerships
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
            Get in Touch with VUNVAULT
          </h2>
          <p className="text-neutral-500 text-base sm:text-lg max-w-2xl leading-relaxed">
            Reach the team directly to discuss an assessment, ask a question or become a partner.
          </p>
        </div>

        <div className="space-y-4 max-w-3xl">
          <a
            href="https://wa.me/254705998032"
            target="_blank"
            rel="noopener noreferrer"
            className="p-5 sm:p-6 rounded-2xl glass-card border border-neutral-200/80 hover:border-neutral-900 transition-all duration-200 flex items-center gap-5 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <MessageCircle size={20} aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                WHATSAPP
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-neutral-900 group-hover:text-indigo-600 transition-colors font-mono">
                +254 705 998 032
              </div>
            </div>
          </a>

          <a
            href="mailto:support@vunvault.com"
            className="p-5 sm:p-6 rounded-2xl glass-card border border-neutral-200/80 hover:border-neutral-900 transition-all duration-200 flex items-center gap-5 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <Mail size={20} aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                EMAIL
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-neutral-900 group-hover:text-indigo-600 transition-colors font-mono">
                info@vunvault.com
              </div>
            </div>
          </a>

          <div className="p-5 sm:p-6 rounded-2xl glass-card border border-neutral-200/80 flex items-start gap-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs mt-0.5">
              <MapPin size={20} aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                BASED IN
              </div>
              <div className="text-base sm:text-lg font-bold text-neutral-900 leading-snug">
                Nairobi, Kenya — serving clients across Africa and worldwide.
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3" aria-label="VUNVAULT social profiles">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={href}
                className="social-link"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
              >
                <Icon aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

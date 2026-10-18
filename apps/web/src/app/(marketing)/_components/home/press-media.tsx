import Link from 'next/link';
import { FileText, Mail, Quote } from 'lucide-react';
import '../../_styles/home-end.css';

/**
 * Press & Media section . Server component, static copy — verbatim
 * from the design, including the featured commentary blockquote.
 *
 * `Contact Press Office` is the design's mailto; `Request a Report` routes
 * to the contact form with the penetration-testing category preselected
 * (an earlier iteration reads the query).
 */
export function PressMedia() {
  return (
    <section id="press-media" className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
            PRESS &amp; MEDIA
          </span>
        </div>

        <div className="space-y-4 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            For journalists and partners
          </h2>
          <p className="text-neutral-600 text-base sm:text-lg leading-relaxed font-normal">
            VUNVAULT is an Africa-rooted cybersecurity firm headquartered in Nairobi, Kenya,
            providing penetration testing, vulnerability assessments and security education to
            organizations of every size, across Africa and worldwide.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 relative overflow-hidden shadow-xs space-y-4">
          <div className="absolute top-6 left-6 text-neutral-200/60 pointer-events-none">
            <Quote size={40} aria-hidden="true" />
          </div>
          <blockquote className="relative z-10 text-neutral-800 text-sm sm:text-base md:text-lg font-medium leading-relaxed pl-4 border-l-4 border-indigo-600">
            “The Minnesota attacks were not sophisticated, and that is exactly what makes them
            dangerous. Attackers simply found control systems left connected to the internet, often
            with default passwords. Every utility should treat perimeter security as mission
            critical.”
          </blockquote>
          <div className="pt-2 flex items-center justify-between text-xs text-neutral-500 font-mono">
            <span>— VUNVAULT Threat Intelligence Commentary</span>
            <span className="text-cyan-700 font-bold">Featured in Global Tech Press</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-bold text-sm">Media Inquiries &amp; Interview Requests</h4>
            <p className="text-xs text-neutral-400">
              Direct press contact:{' '}
              <code className="text-cyan-400 font-mono">press@vunvault.com</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:press@vunvault.com"
              className="bg-cyan-400 hover:bg-cyan-300 text-neutral-950 text-xs font-bold px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              <Mail size={14} aria-hidden="true" />
              <span>Contact Press Office</span>
            </a>
            <Link
              href="/contact?category=penetration_testing_request#contact-form"
              className="border border-white/25 hover:bg-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5"
            >
              <FileText size={14} aria-hidden="true" />
              <span>Request a Report</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

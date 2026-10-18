import '../_styles/contact.css';

/**
 * Contact hero — eyebrow, headline, the four-reasons lead and the
 * two anchors (`#contact-form` → the form, `#direct-channels` → the side
 * cards). Server component; copy verbatim.
 */
export function ContactHero() {
  return (
    <section className="relative pt-12 pb-10 md:pt-20 md:pb-14 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <span className="hero-eyebrow">Contact · Press · Disclosure</span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            Let’s secure your perimeter
          </h1>
          <p className="text-lg sm:text-xl text-neutral-500 font-normal max-w-2xl mx-auto leading-relaxed">
            Request a penetration test, report a vulnerability, apply for a Journalist / Blogger
            profile, or submit a confidential whistleblower tip — all from one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a href="#contact-form" className="btn-get-started">
              Start a Request
            </a>
            <a
              href="#direct-channels"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-full text-sm font-bold text-neutral-900 bg-white border border-neutral-200 hover:border-neutral-900 transition-colors"
            >
              <span>Direct channels</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

import '../_styles/services.css';

/**
 * Request-assessment band — replaces the an earlier iteration stub. The glass
 * card closing the page: mailto with the pre-filled subject exactly as the
 * design encodes it, the WhatsApp deep link, and the trust line. Server
 * component; both anchors are external schemes (mailto/wa.me), so they stay
 * plain `<a>` elements.
 */
export function RequestBand() {
  return (
    <section
      id="request-assessment"
      className="py-14 md:py-20 border-t border-neutral-200/80 bg-paper"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-12 text-center space-y-5 border border-neutral-200/90">
          <span className="vv-kicker">Next step</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Request an assessment under mutual NDA
          </h2>
          <p className="text-neutral-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Send us your target scope, compliance deadline and preferred timeline. We reply with a
            written scope, rules-of-engagement draft and a fixed quote — usually within one business
            day.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <a
              href="mailto:info@vunvault.com?subject=Assessment%20Request%20%E2%80%94%20VUNVAULT"
              className="btn-get-started"
            >
              Email info@vunvault.com
            </a>
            <a
              href="https://wa.me/254705998032"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-4 text-sm font-bold text-neutral-900 bg-white border border-neutral-200 rounded-full hover:border-neutral-400 transition-colors"
            >
              WhatsApp +254 705 998 032
            </a>
          </div>
          <p className="pt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
            NDA on request · Scope before invoice · No data retained
          </p>
        </div>
      </div>
    </section>
  );
}

import '../_styles/advisories.css';

/**
 * Advisories hero — the verbatim eyebrow/title/sub. Presentational;
 * no directive, rendered by the server page above the client feed.
 */
export function AdvisoriesHero() {
  return (
    <section className="pt-10 md:pt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <span className="vad-eyebrow">Threat Intelligence</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            Security Advisories
          </h1>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
            Emergency zero-day advisories from the VUNVAULT intelligence desk, matched to your
            environment.
          </p>
        </div>
      </div>
    </section>
  );
}

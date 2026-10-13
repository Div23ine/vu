import '../_styles/security.css';

/**
 * Security hero (Task 67) — the verbatim eyebrow/title/sub. Presentational;
 * no directive, rendered by the server page above the client cards.
 */
export function SecurityHero() {
  return (
    <section className="pt-10 md:pt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <span className="vpm-eyebrow">Security & Account Protection</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            Password Manager & Security
          </h1>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
            Rotate your credentials, harden your account with two-factor authentication and generate
            offline recovery keys you can trust when everything else fails.
          </p>
        </div>
      </div>
    </section>
  );
}

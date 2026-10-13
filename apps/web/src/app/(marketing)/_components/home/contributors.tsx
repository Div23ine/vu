import '../../_styles/home-end.css';

/**
 * Contributors section (Task 52) — "The people behind the defense".
 *
 * Four cards in prototype order. Per the catalogue the avatars are circular
 * INITIALS tiles built from the name (`AN`, `DM`, `FH`, `BO`) — no
 * photographs are added anywhere in this task. Names and bios are verbatim.
 */

export interface Contributor {
  name: string;
  role: string;
  bio: string;
  initials: string;
}

export const CONTRIBUTORS: readonly Contributor[] = [
  {
    name: 'Amara Njoroge',
    role: 'Offensive Security Lead',
    bio: 'Designs and runs red-team engagements for SACCOs, fintechs and M-Pesa gateway providers across East Africa.',
    initials: 'AN',
  },
  {
    name: 'Daniel Mwangi',
    role: 'Security Automation Engineer',
    bio: 'Builds the continuous attack-surface enumeration agents and automated patch-validation CLI behind the VUNVAULT engine.',
    initials: 'DM',
  },
  {
    name: 'Fatima Hassan',
    role: 'Threat Intelligence Analyst',
    bio: 'Curates the zero-day tracking feed, correlates CVE data with vendor advisories and authors VUNVAULT threat briefings.',
    initials: 'FH',
  },
  {
    name: 'Brian Otieno',
    role: 'Compliance & Curriculum Lead',
    bio: 'Maps audit findings to Central Bank frameworks and authors the VUNVAULT Academy cybersecurity foundations course.',
    initials: 'BO',
  },
];

export function Contributors() {
  return (
    <section
      id="contributors"
      className="contributors py-14 md:py-20 border-t border-neutral-200/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="contributors-header">
          <div className="flex items-center gap-2">
            <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              CONTRIBUTORS
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            The people behind the defense
          </h2>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed max-w-2xl">
            Ethical hackers, security engineers and threat researchers building VUNVAULT’s
            detection, automation and education stack.
          </p>
        </header>

        <div className="contributors-grid">
          {CONTRIBUTORS.map((contributor) => (
            <article key={contributor.name} className="contributor-card circular">
              <div className="contributor-avatar-wrap">
                <span className="contributor-avatar contributor-avatar-initials" aria-hidden="true">
                  {contributor.initials}
                </span>
              </div>
              <h4 className="contributor-name">{contributor.name}</h4>
              <p className="contributor-role">{contributor.role}</p>
              <p className="contributor-bio">{contributor.bio}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

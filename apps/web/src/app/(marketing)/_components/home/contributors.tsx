/* eslint-disable @next/next/no-img-element -- avatars are pre-optimised 640px
  square crops served statically from public/images/contributors; a plain
  <img> keeps the section a dependency-free server component. */
import '../../_styles/home-end.css';

/**
 * Contributors section — "The people behind the defense".
 *
 * Six photo cards in team order. The avatars are photographs served from
 * `public/images/contributors/` (square crops, circular frame via the
 * design's `.contributor-avatar` rules). Names, roles and photos are
 * edited in the `CONTRIBUTORS` array below; the `/about` team roster
 * (`about/_data/about-data.ts`) mirrors this list and adds the bios.
 */

export interface Contributor {
  name: string;
  role: string;
  photo: string;
}

export const CONTRIBUTORS: readonly Contributor[] = [
  {
    name: 'Esther',
    role: 'Cybersecurity and Digital Operations',
    photo: '/images/contributors/contributor-01.jpg',
  },
  {
    name: 'Natasha',
    role: 'Cybersecurity Analyst',
    photo: '/images/contributors/contributor-02.jpg',
  },
  {
    name: 'Jaymit Sarena',
    role: 'Security Analyst VAPT',
    photo: '/images/contributors/contributor-03.jpg',
  },
  {
    name: 'Raphunga Tshepiso',
    role: 'Research Analyst',
    photo: '/images/contributors/contributor-04.jpg',
  },
  {
    name: 'Daniel Okafor',
    role: 'Security and Project Coordinator',
    photo: '/images/contributors/contributor-05.jpg',
  },
  {
    name: 'Divine',
    role: 'Marketing Strategist and Social Media Manager',
    photo: '/images/contributors/contributor-06.jpg',
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
            <article key={contributor.photo} className="contributor-card circular">
              <div className="contributor-avatar-wrap">
                <img
                  className="contributor-avatar"
                  src={contributor.photo}
                  alt={`Portrait of ${contributor.name}`}
                  width={640}
                  height={640}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <h4 className="contributor-name">{contributor.name}</h4>
              <p className="contributor-role">{contributor.role}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

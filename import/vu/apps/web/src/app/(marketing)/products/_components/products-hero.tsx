import { Wrench } from 'lucide-react';
import '../_styles/products.css';

/**
 * Products hero — headline, dual CTAs (`#catalog` → the premium
 * grid, `#free-tools` → an earlier iteration's free-resources section) and the four-stat
 * glass strip. Server component; copy and stats verbatim.
 */

const HERO_STATS = [
  { label: 'Tools Shipped', value: '24' },
  { label: 'Free Resources', value: '12' },
  { label: 'Active Operators', value: '3,180' },
  { label: 'Mean Patch Time', value: '1.2s' },
] as const;

export function ProductsHero() {
  return (
    <section className="relative pt-12 pb-14 md:pt-20 md:pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <span className="hero-eyebrow">Tools · Automation · Documentation</span>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            Security Tooling Built For Operators
          </h1>
          <p className="text-lg sm:text-xl text-neutral-500 font-normal max-w-2xl mx-auto leading-relaxed">
            Battle-tested penetration testing utilities, automation scripts and technical
            documentation — built by the team that maps Africa’s attack surfaces every day.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <a href="#catalog" className="btn-get-started">
              Explore Catalog
            </a>
            <a href="#free-tools" className="btn-outline">
              <Wrench size={16} aria-hidden="true" />
              <span>Free Tools</span>
            </a>
          </div>
        </div>

        <div className="vv-stat-strip">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="vv-stat">
              <span className="vv-stat-label">{stat.label}</span>
              <span className="vv-stat-value">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

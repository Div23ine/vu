import { HERO_METRICS } from './home-data';
import { NetworkMap } from './network-map';
import '../../_styles/hero.css';

/**
 * Home hero — headline, CTA and the animated Live Attack Surface
 * panel. Server component: every animated piece is CSS-only (pulse, dash,
 * scanline, ping), driven from `hero.css`, with the global reduced-motion
 * block as the fallback. The `Get Started` CTA targets the `#get-started`
 * anchor that follows the assembled home sections .
 */
export function Hero() {
  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <span className="hero-eyebrow">Africa-rooted · Worldwide defense</span>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
            We Find The Cracks Before They Do
          </h1>
          <p className="text-lg sm:text-xl text-neutral-500 font-normal max-w-2xl mx-auto leading-relaxed">
            Advanced vulnerability management through intelligent automation and proactive defense
            strategies.
          </p>
          <div className="flex items-center justify-center pt-4">
            <a href="#get-started" className="btn-get-started">
              Get Started
            </a>
          </div>
        </div>

        <div className="mt-14 md:mt-18 max-w-5xl mx-auto">
          <div className="hero-visual">
            <div className="hero-visual-glow" aria-hidden="true" />
            <div className="hero-grid" aria-hidden="true" />
            <div className="hero-visual-inner">
              <div className="hero-visual-head">
                <div>
                  <div className="hero-visual-eyebrow">VUNVAULT</div>
                  <h2 className="hero-visual-title">Live Attack Surface</h2>
                </div>
                <div className="glass-pill hero-status">
                  <span className="hero-status-dot" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                  <span>SYSTEM STATUS: SECURE</span>
                </div>
              </div>

              <div className="hero-visual-stage">
                <NetworkMap />
                <span className="hero-scanline" aria-hidden="true" />
              </div>

              <div className="hero-visual-foot">
                {HERO_METRICS.map((metric) => (
                  <div key={metric.label} className="hero-metric">
                    <span className="hero-metric-label">{metric.label}</span>
                    <span className="hero-metric-value">{metric.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

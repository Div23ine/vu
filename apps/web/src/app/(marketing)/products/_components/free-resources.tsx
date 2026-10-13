import {
  Activity,
  ClipboardCheck,
  Download,
  FileText,
  Rss,
  Shield,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import {
  DOWNLOAD_BUTTON_TITLE,
  FREE_RESOURCES,
  FREE_RESOURCES_FOOTNOTE,
  type FreeResource,
} from '../_data/free-resources';
import '../_styles/products.css';

/**
 * Free resources grid (Task 55b) — replaces the Task 55 stub.
 *
 * Six community cards, copy verbatim. The prototype's Download buttons carry
 * no file URLs and none are published yet, so per the catalogue they render
 * disabled with an explanatory title until the files exist.
 */

const ICONS: Readonly<Record<FreeResource['icon'], LucideIcon>> = {
  terminal: Terminal,
  'file-text': FileText,
  shield: Shield,
  activity: Activity,
  'clipboard-check': ClipboardCheck,
  rss: Rss,
};

export function FreeResources() {
  return (
    <>
      <span id="free-tools" className="anchor-offset" aria-hidden="true" />
      <section
        id="free-resources"
        className="py-14 md:py-20 bg-paper border-t border-neutral-200/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vv-sec-head">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-[2px] w-6 bg-emerald-500 rounded-full" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Free Resources
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
                Open tooling, no licence required
              </h2>
              <p className="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed">
                Community resources published under permissive licences. Click download and the file
                is fetched straight from the source — no checkout, no account, no telemetry.
              </p>
            </div>
            <span className="vv-prod-badge vv-prod-badge--free">
              {FREE_RESOURCES.length} Resources
            </span>
          </div>

          <div className="vv-prod-grid">
            {FREE_RESOURCES.map((resource) => {
              const Icon = ICONS[resource.icon];
              return (
                <article key={resource.id} className="vv-prod-card vv-prod-card--free">
                  <div className="vv-prod-head">
                    <div className="vv-prod-icon">
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <span className="vv-prod-badge vv-prod-badge--free">Free</span>
                  </div>
                  <div className="vv-prod-body">
                    <h3 className="vv-prod-title">{resource.name}</h3>
                    <p className="vv-prod-desc">{resource.description}</p>
                    <div className="vv-prod-tags">
                      {resource.tags.map((tag) => (
                        <span key={tag} className="vv-skill">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="vv-prod-foot">
                      <span className="vv-prod-size">{resource.size}</span>
                      {/* TODO(content): file URLs — enabled when the files ship. */}
                      <button
                        type="button"
                        className="vv-prod-dl"
                        disabled
                        aria-disabled="true"
                        title={DOWNLOAD_BUTTON_TITLE}
                      >
                        <span>Download</span>
                        <Download size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="text-center text-xs text-neutral-500 mt-8">{FREE_RESOURCES_FOOTNOTE}</p>
        </div>
      </section>
    </>
  );
}

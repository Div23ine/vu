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
import { OpenToolsResponseSchema, type OpenTool } from '@vunvault/contracts';
import { env } from '../../../../env';
import { ToolWaitlistButton } from './tool-waitlist-button';
import '../_styles/products.css';

/**
 * Open tooling grid — the spec lives in the `open_tools` table and is
 * fetched from the API (60 s revalidate), never inlined here. A tool is listed
 * the moment it is announced: when `fileUrl` is null the card offers its
 * waitlist instead of a download, so an unpublished artifact never hides the
 * tool from the page.
 */

const ICONS: Record<string, LucideIcon> = {
  terminal: Terminal,
  'file-text': FileText,
  shield: Shield,
  activity: Activity,
  'clipboard-check': ClipboardCheck,
  rss: Rss,
};

const FOOTNOTE =
  'Free resources are provided as-is for authorised testing only. Never scan systems you do not own or have written permission to assess.';

export async function loadOpenTools() {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/public/tools`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    const parsed = OpenToolsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.data : [];
  } catch {
    return [];
  }
}

export async function FreeResources() {
  const tools = await loadOpenTools();
  return <FreeResourcesGrid tools={tools} />;
}

export function FreeResourcesGrid({ tools }: { tools: readonly OpenTool[] }) {
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
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
                Open tooling, free forever
              </h2>
              <p className="text-neutral-500 text-base sm:text-lg leading-relaxed max-w-2xl">
                The utilities, checklists and feeds our assessors use between engagements —
                published for the community. Tools without a published artifact yet can be joined
                via their waitlist.
              </p>
            </div>
          </div>

          <div className="vv-free-grid">
            {tools.map((tool) => {
              const Icon = ICONS[tool.icon] ?? Terminal;
              return (
                <article key={tool.id} className="vv-free-card">
                  <div className="vv-free-head">
                    <span className="vv-free-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="vv-free-name">{tool.name}</h3>
                      {tool.sizeLabel && <span className="vv-free-size">{tool.sizeLabel}</span>}
                    </div>
                  </div>
                  <p className="vv-free-desc">{tool.summary}</p>
                  <div className="vv-free-tags">
                    {tool.tags.map((tag) => (
                      <span key={tag} className="vv-free-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="vv-free-foot">
                    {tool.fileUrl ? (
                      <a className="vv-free-download" href={tool.fileUrl} download>
                        <Download size={16} aria-hidden="true" />
                        Download
                      </a>
                    ) : (
                      <ToolWaitlistButton toolId={tool.id} toolName={tool.name} />
                    )}
                  </div>
                </article>
              );
            })}
            {tools.length === 0 && (
              <p className="text-neutral-500 text-sm">
                The open tooling catalog is being refreshed — check back shortly.
              </p>
            )}
          </div>
          <p className="vv-free-footnote">{FOOTNOTE}</p>
        </div>
      </section>
    </>
  );
}

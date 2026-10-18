import type { ReactNode } from 'react';
import '../_styles/legal.css';

/**
 * Shared shell for the published legal documents (privacy, terms, cookie
 * policy, responsible disclosure). Server component: the documents are plain
 * prose with stable anchors, so nothing here needs a client boundary.
 */

export interface LegalDocProps {
  eyebrow: string;
  title: string;
  /** ISO date of the current revision, shown in the header. */
  updated: string;
  /** Semantic version of the document; the consent gate keys off changes. */
  version: string;
  intro: ReactNode;
  children: ReactNode;
}

export function LegalDoc({ eyebrow, title, updated, version, intro, children }: LegalDocProps) {
  return (
    <section className="vv-legal-section py-14 md:py-20 bg-paper">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="vv-legal-head">
          <div className="flex items-center gap-2">
            <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              {eyebrow}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            {title}
          </h1>
          <p className="vv-legal-meta">
            Last updated {updated} · Version {version}
          </p>
          <div className="vv-legal-intro">{intro}</div>
        </header>
        <div className="vv-legal-body">{children}</div>
      </div>
    </section>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="vv-legal-chapter">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalSub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3>{title}</h3>
      {children}
    </>
  );
}

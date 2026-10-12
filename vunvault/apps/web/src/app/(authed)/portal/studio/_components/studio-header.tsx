import Link from 'next/link';
import { BadgeCheck, PenLine } from 'lucide-react';
import type { StudioStatus } from '@vunvault/contracts';
import '../_styles/studio.css';

/**
 * Studio header (Task 71) — planner-authored (no prototype): the title, the
 * verbatim contributor line, the author's display name, the `Verified
 * Blogger` chip with its verbatim tooltip and the `New article` action that
 * opens the Task 72 editor. Presentational; rendered by the client gate.
 */

const VERIFIED_TOOLTIP =
  'Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.';

export function StudioHeader({ status }: { status: StudioStatus }) {
  return (
    <header className="vcs-header">
      <div className="vcs-header-text">
        <h1 className="vcs-title">Content Studio</h1>
        <p className="vcs-sub">
          Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you
          submit.
        </p>
        <div className="vcs-meta">
          <span className="vcs-name">{status.displayName}</span>
          <span className="vcs-chip" title={VERIFIED_TOOLTIP}>
            <BadgeCheck size={14} aria-hidden="true" />
            Verified Blogger
          </span>
        </div>
      </div>
      <Link href="/portal/studio/edit/new" className="vbg-btn vbg-btn--primary">
        <PenLine size={15} aria-hidden="true" />
        <span>New article</span>
      </Link>
    </header>
  );
}

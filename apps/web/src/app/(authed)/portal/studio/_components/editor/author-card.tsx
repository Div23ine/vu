'use client';

import Link from 'next/link';
import { BadgeCheck, UserRound } from 'lucide-react';
import { useSession } from '../../../../../../lib/session';
import '../../_styles/editor.css';

/**
 * Author card — from the session: initials avatar, display name,
 * the `Verified Blogger` chip with its verbatim tooltip, the verbatim byline
 * promise and the profile deep-link. The design's fixed demo bio has no
 * field in `SessionUser` and is deliberately not rendered.
 */

const VERIFIED_TOOLTIP =
  'Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.';

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function AuthorCard() {
  const { user } = useSession();
  const name = user?.fullName ?? '—';

  return (
    <section className="vbg-card" aria-labelledby="vbgAuthorHeading">
      <div className="vbg-card-head">
        <div>
          <h2 className="vbg-card-title" id="vbgAuthorHeading">
            <UserRound size={16} aria-hidden="true" />
            Author
          </h2>
        </div>
      </div>
      <div className="vbg-card-body">
        <div className="vbg-author">
          <span className="vbg-author-avatar" aria-hidden="true">
            {initialsOf(name)}
          </span>
          <span className="vbg-author-id">
            <span className="vbg-author-name">{name}</span>
            <span className="vbg-chip" title={VERIFIED_TOOLTIP}>
              <BadgeCheck size={13} aria-hidden="true" />
              Verified Blogger
            </span>
          </span>
        </div>
        <p className="vbg-author-line">
          Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you
          submit.
        </p>
        <div className="vbg-author-meta">
          <span className="vbg-pill vbg-pill--info">Verified</span>
          <span className="vbg-pill vbg-pill--muted">Pre-publication review</span>
        </div>
        <Link href="/portal/profile" className="vbg-author-edit">
          Edit profile &amp; byline
        </Link>
      </div>
    </section>
  );
}

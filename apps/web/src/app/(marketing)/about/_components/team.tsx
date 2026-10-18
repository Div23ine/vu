'use client';

/* eslint-disable @next/next/no-img-element -- team photographs are
  pre-optimised square crops served statically from
  public/images/contributors; a plain <img> keeps the reveal cards
  dependency-free (same convention as the home contributors section). */

import { Github, Linkedin } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { TEAM_MEMBERS, type TeamBadge, type TeamMember } from '../_data/about-data';
import { useReveal } from './about-hero';
import '../_styles/about.css';

/**
 * Contributors & Core Team — the live roster.
 *
 * Six photo cards, the same people, order and photographs as the home page's
 * contributors section. The design's initials tiles are gone; the
 * credential chips, bio, skill chips and meta line are optional and render
 * only once the data exists for a member. No `/team/*` anchor is rendered —
 * those routes do not exist — and the social buttons point at the company
 * profiles recorded in the markup.
 */

const BADGE_CLASS: Record<TeamBadge['variant'], string> = {
  brand: 'vv-team-badge--brand',
  plain: '',
  dark: 'vv-team-badge--dark',
};

function TeamCard({ member }: { member: TeamMember }) {
  const reveal = useReveal<HTMLElement>();
  return (
    <article ref={reveal.ref} className={cn('vv-team-card', reveal.className)}>
      <div className="vv-team-head">
        <div className="vv-team-avatar">
          <img
            src={member.photo}
            alt={`Portrait of ${member.name}`}
            width={640}
            height={640}
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="vv-team-id">
          <h3 className="vv-team-name">{member.name}</h3>
          <p className="vv-team-role">{member.role}</p>
        </div>
      </div>

      {member.badges && member.badges.length > 0 && (
        <div className="vv-team-badges">
          {member.badges.map((badge) => (
            <span key={badge.label} className={cn('vv-team-badge', BADGE_CLASS[badge.variant])}>
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {member.bio && <p className="vv-team-bio">{member.bio}</p>}

      {member.skills && member.skills.length > 0 && (
        <div className="vv-team-skills">
          {member.skills.map((skill) => (
            <span key={skill} className="vv-team-skill">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="vv-team-foot">
        {/* Empty label keeps the socials right-aligned until meta exists. */}
        <span className="vv-team-meta" aria-hidden="true">
          {member.meta ?? ''}
        </span>
        <div className="vv-team-socials">
          <a
            className="social-link"
            href="https://github.com/vunvault"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on GitHub`}
          >
            <Github aria-hidden="true" />
          </a>
          <a
            className="social-link"
            href="https://www.linkedin.com/company/vunvault"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on LinkedIn`}
          >
            <Linkedin aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

export function AboutTeam() {
  return (
    <section className="vv-section" id="contributors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-3xl space-y-4">
          <span className="vv-eyebrow">Contributors &amp; Core Team</span>
          <h2 className="vv-h2">The people behind the defense.</h2>
          <p className="vv-body max-w-2xl">
            Every engagement is staffed by the people below — not subcontracted, not anonymised
            behind a logo.
          </p>
        </div>

        <div className="vv-team-grid">
          {TEAM_MEMBERS.map((member) => (
            <TeamCard key={member.photo} member={member} />
          ))}
        </div>
      </div>
    </section>
  );
}

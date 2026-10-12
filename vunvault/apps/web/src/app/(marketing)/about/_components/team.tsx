'use client';

import { Github, Linkedin } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { TEAM_MEMBERS, type TeamBadge } from '../_data/about-data';
import { useReveal } from './about-hero';
import '../_styles/about.css';

/**
 * Contributors & Core Team (Task 53b) — replaces the Task 53 stub.
 *
 * Four cards, long bios verbatim. The prototype linked each name to
 * `/team/<slug>`; those pages do not exist, so per the catalogue the name is
 * plain text and no `/team/*` anchor is rendered — the meta line stays as the
 * monospace label it was. Avatars are initials tiles (no photographs). The
 * social buttons point at the company profiles recorded in the markup.
 */

const BADGE_CLASS: Record<TeamBadge['variant'], string> = {
  brand: 'vv-team-badge--brand',
  plain: '',
  dark: 'vv-team-badge--dark',
};

export function AboutTeam() {
  const reveals = [
    useReveal<HTMLElement>(),
    useReveal<HTMLElement>(),
    useReveal<HTMLElement>(),
    useReveal<HTMLElement>(),
  ];

  return (
    <section className="vv-section" id="contributors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-3xl space-y-4">
          <span className="vv-eyebrow">Contributors &amp; Core Team</span>
          <h2 className="vv-h2">The people behind the defense.</h2>
          <p className="vv-body max-w-2xl">
            Four disciplines, one floor. Every engagement is staffed by the people below — not
            subcontracted, not anonymised behind a logo.
          </p>
        </div>

        <div className="vv-team-grid">
          {TEAM_MEMBERS.map((member, index) => {
            const reveal = reveals[index];
            return (
              <article
                key={member.name}
                ref={reveal?.ref}
                className={cn('vv-team-card', reveal?.className)}
              >
                <div className="vv-team-head">
                  <div className="vv-team-avatar">
                    <span className="vv-team-initials" aria-hidden="true">
                      {member.initials}
                    </span>
                  </div>
                  <div className="vv-team-id">
                    <h3 className="vv-team-name">{member.name}</h3>
                    <p className="vv-team-role">{member.role}</p>
                  </div>
                </div>

                <div className="vv-team-badges">
                  {member.badges.map((badge) => (
                    <span
                      key={badge.label}
                      className={cn('vv-team-badge', BADGE_CLASS[badge.variant])}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                <p className="vv-team-bio">{member.bio}</p>

                <div className="vv-team-skills">
                  {member.skills.map((skill) => (
                    <span key={skill} className="vv-team-skill">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="vv-team-foot">
                  <span className="vv-team-meta">{member.meta}</span>
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
          })}
        </div>
      </div>
    </section>
  );
}

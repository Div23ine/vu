'use client';

/* The avatar is a remote, user-owned image; see `avatar-uploader.tsx` for why
   it is a plain <img> (and why an SVG must never be inlined here). */
/* eslint-disable @next/next/no-img-element */
import { Calendar, Clock, ShieldCheck, UserCheck, Users } from 'lucide-react';
import type { ProfileSettings } from '@vunvault/contracts';
import { ROLE_LABELS } from '@vunvault/contracts';
import { formatMonthYear, formatRelativeActive } from '@vunvault/lib';
import { initialsOf } from '../_hooks/use-account-settings';

/**
 * Identity header (Task 83c) — the administrator's own card.
 *
 * Every value is read from `ProfileSettings`: the name is `firstName` +
 * `lastName`, the role line is `ROLE_LABELS[role]`, member-since is
 * `formatMonthYear(memberSince)`, the MFA chip is the API's own `mfaSummary`
 * string, last sign-in is `formatRelativeActive(lastSignInAt)` and the session
 * count is `activeSessions`.
 *
 * DEVIATION (documented): the prototype's meta line reads
 * `Super Administrator · Incident Commander`. `ProfileSettings` has no
 * incident-commander flag and the plan's decision #8 says the label is not
 * shown, so the middle slot carries the member-since date instead — the header
 * never asserts a role the API does not grant.
 *
 * The avatar is an `<img>` when `avatarUrl` is set and the initials disc
 * otherwise. SVGs go through `<img>` only, never inline, so an uploaded file
 * cannot script in this origin.
 */

export interface IdentityHeaderProps {
  profile: ProfileSettings | null;
  isLoading: boolean;
}

export function IdentityHeader({ profile, isLoading }: IdentityHeaderProps) {
  if (isLoading || profile === null) {
    return (
      <section className="ps-identity" aria-labelledby="ps-identity-heading" aria-busy="true">
        <div className="ps-identity-left">
          <div className="ps-avatar-wrap">
            <span className="ps-avatar" id="ps-identity-avatar" aria-hidden="true" />
          </div>
          <div className="ps-identity-text">
            <h2 className="ps-identity-name" id="ps-identity-heading">
              —
            </h2>
          </div>
        </div>
      </section>
    );
  }

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const initials = initialsOf(profile.firstName, profile.lastName);

  return (
    <section className="ps-identity" aria-labelledby="ps-identity-heading">
      <div className="ps-identity-left">
        <div className="ps-avatar-wrap">
          <span className="ps-avatar" id="ps-identity-avatar" aria-hidden="true">
            {profile.avatarUrl === null ? initials : <img src={profile.avatarUrl} alt="" />}
          </span>
          <span className="ps-avatar-badge" aria-hidden="true">
            <ShieldCheck size={13} />
          </span>
        </div>
        <div className="ps-identity-text">
          <span className="ps-identity-eyebrow">
            <UserCheck size={12} aria-hidden="true" />
            Verified Administrator
          </span>
          <h2 className="ps-identity-name" id="ps-identity-heading">
            {fullName === '' ? '—' : fullName}
          </h2>
          <div className="ps-identity-meta">
            <span>{ROLE_LABELS[profile.role]}</span>
            <span aria-hidden="true">·</span>
            <span>
              <Calendar size={11} aria-hidden="true" /> Member since{' '}
              {formatMonthYear(new Date(profile.memberSince))}
            </span>
            <span aria-hidden="true">·</span>
            <code>@{profile.username}</code>
            <code>{profile.email}</code>
          </div>
          {profile.bio === null || profile.bio === '' ? null : (
            <p className="ps-identity-bio">{profile.bio}</p>
          )}
        </div>
      </div>

      <div className="ps-identity-right">
        <span className="ps-identity-stat ps-identity-stat--ok">
          <ShieldCheck size={12} aria-hidden="true" />
          MFA: <strong>{profile.mfaSummary}</strong>
        </span>
        <span className="ps-identity-stat">
          <Clock size={12} aria-hidden="true" />
          Last sign-in:{' '}
          <strong id="ps-last-signin">
            {profile.lastSignInAt === null
              ? '—'
              : formatRelativeActive(new Date(profile.lastSignInAt), new Date())}
          </strong>
        </span>
        <span className="ps-identity-stat">
          <Users size={12} aria-hidden="true" />
          Sessions: <strong>{profile.activeSessions} active</strong>
        </span>
      </div>
    </section>
  );
}

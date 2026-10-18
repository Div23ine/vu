'use client';

import Link from 'next/link';
import { Fingerprint, GraduationCap, KeyRound, Radar, Receipt } from 'lucide-react';
import type { SubscriptionStatus } from '@vunvault/contracts';
import { Skeleton } from '@vunvault/ui';
import { useClientProfile } from '../_hooks/use-client-profile';
import { AccountStats } from './account-stats';
import '../_styles/profile.css';

/**
 * Profile hero — the dark identity header (initials avatar, name,
 * company · jobTitle line, the CLIENT ID / plan / subscription chips and the
 * three account stats) plus the four shortcut tiles from the design.
 *
 * Tile targets: Academy → `/portal/academy` (an earlier iteration placeholder), Billing →
 * `/portal/billing` , Password Manager → `/portal/security` (Task
 * 67); the Free Vulnerability Scanner lives on the marketing home (an earlier iteration's
 * dialog is mounted there, not in the portal), so its tile links to `/`.
 * The plan chip's status label maps `active` → `Subscription Active`
 * (the design's copy); other statuses get the same sentence pattern.
 */

function initialsOf(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || 'VV';
}

const PLAN_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Subscription Active',
  past_due: 'Subscription Past Due',
  canceled: 'Subscription Canceled',
  incomplete: 'Subscription Incomplete',
};

const TILES = [
  {
    href: '/portal/academy',
    Icon: GraduationCap,
    title: 'Academy Progress',
    text: 'Track your learning tracks and certificates.',
  },
  {
    href: '/',
    Icon: Radar,
    title: 'Free Vulnerability Scanner',
    text: 'Run a live reconnaissance sweep on your perimeter.',
  },
  {
    href: '/portal/billing',
    Icon: Receipt,
    title: 'Billing & Invoices',
    text: 'Review statements, plans and payment history.',
  },
  {
    href: '/portal/security',
    Icon: KeyRound,
    title: 'Password Manager',
    text: 'Audit credentials and vault hygiene.',
  },
] as const;

export function ProfileHero() {
  const { data, isLoading } = useClientProfile();

  return (
    <>
      <div className="vvp-identity">
        <div className="vvp-identity-glow" aria-hidden="true" />
        {isLoading || data === undefined ? (
          <div className="vvp-identity-body" aria-busy="true">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-3 h-4 w-72" />
          </div>
        ) : (
          <>
            <div className="vvp-avatar" aria-hidden="true">
              {initialsOf(data.fullName)}
            </div>
            <div className="vvp-identity-body">
              <h1 className="vvp-identity-name">{data.fullName}</h1>
              <p className="vvp-identity-company">
                {data.company.name}
                {data.jobTitle !== null ? ` · ${data.jobTitle}` : ''}
              </p>
              <div className="vvp-chip-row">
                <span className="vvp-chip vvp-chip--mono">
                  <Fingerprint aria-hidden="true" />
                  CLIENT ID {data.clientCode}
                </span>
                {data.plan !== null ? (
                  <>
                    <span className="vvp-chip">{data.plan.name}</span>
                    <span className="vvp-chip">{PLAN_STATUS_LABELS[data.plan.status]}</span>
                  </>
                ) : null}
              </div>
            </div>
            <AccountStats stats={data.stats} />
          </>
        )}
      </div>

      <div className="vvp-tiles">
        {TILES.map(({ href, Icon, title, text }) => (
          <Link key={title} href={href} className="vvp-tile">
            <span className="vvp-tile-icon" aria-hidden="true">
              <Icon size={19} />
            </span>
            <span className="vvp-tile-title">{title}</span>
            <span className="vvp-tile-text">{text}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

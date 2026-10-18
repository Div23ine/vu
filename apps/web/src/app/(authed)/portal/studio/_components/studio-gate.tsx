'use client';

import Link from 'next/link';
import { BadgeCheck, Check, Lock } from 'lucide-react';
import { Skeleton } from '@vunvault/ui';
import { useStudioStatus } from '../_hooks/use-studio';
import { StudioHeader } from './studio-header';
import { SubmissionsTable } from './submissions-table';
import '../_styles/studio.css';

/**
 * Studio gate — `GET /studio/status` decides the whole page:
 * without the Verified-Blogger badge the access-denied card renders (copy
 * verbatim from the reference markup, with the design's demo-grant button
 * and its localStorage note REMOVED — the badge is granted by an
 * administrator after a Contact-page verification request, never from the
 * browser). Verified users get the header chip and the submissions table.
 */

export function StudioGate() {
  const status = useStudioStatus();

  if (status.isLoading) {
    return (
      <section className="pt-10 pb-16 md:pt-14 md:pb-20" aria-busy="true">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-4 h-4 w-96" />
          <Skeleton className="mt-10 h-72 w-full" />
        </div>
      </section>
    );
  }

  const data = status.data;
  if (status.isError || data === undefined) {
    return (
      <section className="pt-10 pb-16 md:pt-14 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm text-ink-muted">The studio status could not be loaded.</p>
        </div>
      </section>
    );
  }

  if (!data.verified) {
    return <StudioDenied />;
  }

  return (
    <>
      <section className="pt-10 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StudioHeader status={data} />
        </div>
      </section>
      <section className="pt-10 md:pt-12 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SubmissionsTable />
        </div>
      </section>
    </>
  );
}

function StudioDenied() {
  return (
    <section className="vbg-denied">
      <div className="vbg-denied-card">
        <div className="vbg-denied-glow" aria-hidden="true" />
        <span className="vbg-denied-icon" aria-hidden="true">
          <Lock size={30} />
        </span>
        <span className="vbg-denied-eyebrow">Access Restricted</span>
        <h1 className="vbg-denied-title">Verified Journalist / Blogger badge required</h1>
        <p className="vbg-denied-text">
          You need a <strong>Verified Journalist / Blogger Badge</strong> to publish content on
          VUNVAULT. This studio lets approved writers draft articles, attach media and submit posts
          into the pre-publication moderation queue. Unverified accounts cannot open it.
        </p>
        <ul className="vbg-denied-list">
          <li>
            <Check size={15} aria-hidden="true" />
            <span>
              Submit a verification request through the Contact page using the{' '}
              <strong>Journalist / Blogger Profile Request</strong> category.
            </span>
          </li>
          <li>
            <Check size={15} aria-hidden="true" />
            <span>Our editorial team verifies your identity and publication history manually.</span>
          </li>
          <li>
            <Check size={15} aria-hidden="true" />
            <span>
              Once approved, this studio unlocks and your posts enter admin moderation before
              publishing.
            </span>
          </li>
        </ul>
        <div className="vbg-denied-actions">
          <Link
            href="/contact?category=journalist_blogger_profile_request#contact-form"
            className="vbg-btn vbg-btn--primary"
          >
            <BadgeCheck size={15} aria-hidden="true" />
            <span>Request Verification</span>
          </Link>
          <Link href="/" className="vbg-btn vbg-btn--ghost">
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}

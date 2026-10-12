import type { Metadata } from 'next';
import { AcceptInviteForm } from './_components/accept-invite-form';

/**
 * `/accept-invite?token=` (Task 63) — the staff invitation landing. The
 * public preview endpoint drives the states; the token is read once here and
 * handed to the form as a prop (never stored).
 */

export const metadata: Metadata = {
  title: 'Join VUNVAULT',
  robots: { index: false },
};

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const params = await searchParams;
  return <AcceptInviteForm token={params.token ?? null} />;
}

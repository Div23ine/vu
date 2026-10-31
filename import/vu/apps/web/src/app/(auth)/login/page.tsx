import type { Metadata } from 'next';
import { MagicLinkCard } from './_components/magic-link-card';
import { safeNextPath } from './_lib/next-path';

/**
 * `/login` (Phase 1 magic-link work order).
 *
 * The password form is GONE: the only email credential path is the magic
 * link (`POST /auth/magic-link`), and the second factor lives on its own
 * page at `/login/mfa` (the API redirects there after a verified link or an
 * OAuth staff sign-in). This route reads `?next=` (sanitised on the server
 * before the card ever sees it) and `?error=` (OAuth returns AND magic-link
 * verify refusals → toasts).
 */

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <MagicLinkCard next={safeNextPath(params.next)} error={params.error ?? null} />;
}

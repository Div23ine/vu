import type { Metadata } from 'next';
import { LoginCard } from './_components/login-card';
import { MfaDialog } from './_components/mfa-dialog';
import { safeNextPath } from './_hooks/use-login';

/**
 * `/login` (an earlier iteration; an earlier iteration mounts the MFA dialog here — the login card is
 * untouched). The route reads `?next=` (sanitised on the server before the
 * card ever sees it), `?error=` (OAuth/MFA return codes → toasts) and
 * `?mfa=1` (an OAuth return that still needs a second factor → the dialog
 * opens immediately via the store).
 */

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string; mfa?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <>
      <LoginCard
        next={safeNextPath(params.next)}
        error={params.error ?? null}
        mfaRequested={params.mfa === '1'}
      />
      <MfaDialog />
    </>
  );
}

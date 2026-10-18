import type { Metadata } from 'next';
import { ResetForm } from './_components/reset-form';

/**
 * `/reset-password?token=` — the link the forgot-password email
 * carries. The token is read once here and handed to the form as a prop; it
 * is never stored anywhere else. A missing token renders the invalid-link
 * state directly.
 */

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false },
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  return <ResetForm token={params.token ?? null} />;
}

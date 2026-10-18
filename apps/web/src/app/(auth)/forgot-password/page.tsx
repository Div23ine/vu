import type { Metadata } from 'next';
import { ForgotForm } from './_components/forgot-form';

/**
 * `/forgot-password` — enumeration-safe reset request: the card
 * always ends on `Check your inbox` (except on a network failure), so the
 * flow never reveals whether the address has an account.
 */

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}

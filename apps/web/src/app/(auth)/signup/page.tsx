import type { Metadata } from 'next';
import { SignupCard } from './_components/signup-card';
import { SignupVerifyDialog } from './_components/signup-verify-dialog';

/**
 * `/signup` (Task 61). The details form starts the verified signup; the 202
 * opens the verification dialog through the signup store. Task 61 mounts the
 * dialog as a null stub — Task 62 overwrites `signup-verify-dialog.tsx` with
 * the real three-step flow (email OTP → authenticator enrolment → success),
 * so this route file never changes again for it.
 */

export const metadata: Metadata = {
  title: 'Create your account',
  // Consistency addition: every (auth) route is noindex (login, Task 63).
  robots: { index: false },
};

export default function SignupPage() {
  return (
    <>
      <SignupCard />
      <SignupVerifyDialog />
    </>
  );
}

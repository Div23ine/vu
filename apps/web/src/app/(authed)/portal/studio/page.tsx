import type { Metadata } from 'next';
import { StudioGate } from './_components/studio-gate';

/**
 * `/portal/studio` (Task 71) — the Content Studio shell: the server-side
 * Verified-Blogger gate (Task 36 API) and the author's submissions list.
 * The editor lives at `/portal/studio/edit/[id]` (Task 72). The portal
 * layout (Task 45) owns the chrome and the session guard.
 */

export const metadata: Metadata = {
  title: 'Content Studio',
  // Authed portal page — never indexable (the Task 63 auth-page family rule).
  robots: { index: false },
};

export default function StudioPage() {
  return <StudioGate />;
}

import type { Metadata } from 'next';
import { StudioGate } from './_components/studio-gate';

/**
 * `/portal/studio` — the Content Studio shell: the server-side
 * Verified-Blogger gate (an earlier iteration API) and the author's submissions list.
 * The editor lives at `/portal/studio/edit/[id]` . The portal
 * layout owns the chrome and the session guard.
 */

export const metadata: Metadata = {
  title: 'Content Studio',
  // Authed portal page — never indexable (the an earlier iteration auth-page family rule).
  robots: { index: false },
};

export default function StudioPage() {
  return <StudioGate />;
}

/**
 * `(authed)` — everything behind a session: `/onboarding`, `/portal/*`, `/admin/*`.
 *
 * Pass-through for now. Task 43's edge middleware guards the group; a session that
 * has expired between navigations is handled there rather than in each layout, so
 * there is one place that decides what "not signed in" means.
 */
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

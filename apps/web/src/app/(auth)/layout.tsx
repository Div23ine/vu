/**
 * `(auth)` — the unauthenticated flows: `/login`, `/signup`, `/accept-invite`,
 * `/newsletter/confirm`.
 *
 * an earlier iteration turns the pass-through into the full-screen auth shell: the
 * animated background plus a centred overlay the cards sit in. No marketing
 * chrome — the edge middleware keeps signed-in visitors away.
 */
import { AuthBackground } from './_components/auth-background';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vv-auth-overlay">
      <AuthBackground />
      {children}
    </div>
  );
}

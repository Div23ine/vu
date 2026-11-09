import Link from 'next/link';
import { env } from '../../env';

export default function LoginPage() {
  const loginUrl = new URL('/login', env.NEXT_PUBLIC_AUTH_URL);
  loginUrl.searchParams.set('next', '/portal');
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">U</div>
        <p className="eyebrow">VUNVAULT PLATFORM</p>
        <h1>Sign in to UAMP HQ</h1>
        <p className="muted">UAMP HQ uses your secure VUNVAULT account. Sign in on the VUNVAULT identity portal, then return to this subdomain.</p>
        <a className="button button-primary" href={loginUrl.toString()}>Continue to secure sign in</a>
        <p className="tiny">Your session is protected by HttpOnly cookies. UAMP HQ never stores passwords or access tokens in browser storage.</p>
        <Link className="text-link" href="https://www.vunvault.com">Back to VUNVAULT</Link>
      </section>
    </main>
  );
}
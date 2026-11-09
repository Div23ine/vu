import Link from 'next/link';

export default function AccessPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">U</div>
        <p className="eyebrow">UAMP HQ</p>
        <h1>Access not enabled</h1>
        <p className="muted">This VUNVAULT account does not currently have permission to access UAMP HQ. Ask your organisation administrator to review your product access.</p>
        <Link className="button button-secondary" href="https://www.vunvault.com/portal">Return to VUNVAULT</Link>
      </section>
    </main>
  );
}
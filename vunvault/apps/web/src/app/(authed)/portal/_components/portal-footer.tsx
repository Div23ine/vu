import Link from 'next/link';

/**
 * Client-portal footer (Task 45) — the compact `vbb-footer` strip: the portal
 * copyright and four links. No hooks, so it stays a server component.
 */
export function PortalFooter() {
  return (
    <footer className="vbb-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vbb-footer-inner">
          <div>© 2026 VUNVAULT · Client Portal</div>
          <div className="vbb-footer-links">
            <Link href="/">Home</Link>
            <Link href="/services">Services</Link>
            <Link href="/portal/billing">Billing</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

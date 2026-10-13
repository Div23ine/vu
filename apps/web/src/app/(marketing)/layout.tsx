import { ConsentBanner } from './_components/consent/consent-banner';
import { PreloaderGate } from './_components/preloader-gate';
import { ScannerDialog } from './_components/scanner/scanner-dialog';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

/**
 * `(marketing)` — the public site: `/`, `/about`, `/services`, `/products`,
 * `/blog`, `/blog/[slug]`, `/contact`, `/academy`.
 *
 * Task 44 chrome: the first-load preloader gate, the sticky auth-aware
 * header, and the footer whose variant is derived from the route (or passed
 * explicitly). The column is a flex stack so the footer sits at the bottom of
 * a short page without tricks. Task 48 mounts the single Free Scanner dialog
 * instance here; every opener (CTA band, footer link, `data-vv-open-scanner`
 * elements, the `vunvault:open-scanner` event) flips its store. Task 58 adds
 * the cookie-consent banner: it waits for the preloader-done event (or a 6 s
 * fallback) and only appears while the consent decision is unknown.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-neutral-900 flex flex-col">
      <PreloaderGate />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ScannerDialog />
      <ConsentBanner />
    </div>
  );
}

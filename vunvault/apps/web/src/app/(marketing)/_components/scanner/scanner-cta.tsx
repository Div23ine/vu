import { ArrowRight } from 'lucide-react';
import '../../_styles/scanner.css';

/**
 * Free Scanner CTA banner (Task 48) — the dark band that pitches the
 * browser-side reconnaissance demo. Server component: the button carries
 * `data-vv-open-scanner`, and the scanner store's delegated click listener
 * (Task 48) opens the dialog, so no client boundary is needed here.
 *
 * The note is a promise, not decoration: the scan is a simulation — no
 * network request is ever made and nothing is stored.
 */
export function ScannerCta() {
  return (
    <section id="free-scanner" className="vv-scan-cta-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vv-scan-cta">
          <div className="vv-scan-cta-glow" aria-hidden="true" />
          <div className="vv-scan-cta-body">
            <span className="vv-scan-cta-eyebrow">No cost · No commitment</span>
            <h2 className="vv-scan-cta-title">
              We Offer a Free Vulnerability Scan — <span>Scan Now</span>
            </h2>
            <p className="vv-scan-cta-text">
              Point us at a web application, API gateway or public IP range and watch our
              reconnaissance engine enumerate live exposure in real time. Evaluate your perimeter
              before an attacker does.
            </p>
            <div className="vv-scan-cta-actions">
              <button type="button" className="vv-scan-cta-btn" data-vv-open-scanner>
                <span>Request Free Scan</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <span className="vv-scan-cta-note">Runs in your browser · Nothing is stored</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

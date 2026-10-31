// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MpesaApiSecurityPage from './mpesa-api-security/page';
import PenetrationTestingPage from './penetration-testing/page';
import SaccoCompliancePage from './sacco-compliance/page';
import { SAMPLE_REPORT_HREF } from './_components/service-page';

/**
 * Productised service pages — each carries a scope table, deliverables,
 * timeline, the frameworks it really maps to, one redacted sample finding,
 * the watermarked sample report and a booking CTA preselecting its tier.
 */

const PAGES = [
  ['penetration testing', PenetrationTestingPage, '/checkout?plan=starter_scan'],
  ['sacco compliance', SaccoCompliancePage, '/checkout?plan=sacco_fintech_compliance'],
  ['mpesa api security', MpesaApiSecurityPage, '/checkout?plan=starter_scan'],
] as const;

describe.each(PAGES)('%s page', (_name, Page, ctaHref) => {
  it('renders the buyer facts, the sample report and the booking CTA', () => {
    render(<Page />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'What is tested' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What you receive' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Frameworks we map findings to' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Timeline:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /redacted sample report/i })).toHaveAttribute(
      'href',
      SAMPLE_REPORT_HREF,
    );
    expect(screen.getByRole('link', { name: 'Book at checkout' })).toHaveAttribute('href', ctaHref);
    // Honesty: sample findings are labelled illustrative, never live stats.
    expect(screen.getByText(/illustrative, anonymised/)).toBeInTheDocument();
  });
});

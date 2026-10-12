// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MarketingAcademyPage from '../app/(marketing)/academy/page';
import CookiePolicyPage from '../app/(marketing)/cookie-policy/page';
import PrivacyPolicyPage from '../app/(marketing)/privacy/page';
import TermsOfServicePage from '../app/(marketing)/terms/page';
import PortalAcademyPage from '../app/(authed)/portal/academy/page';
import PortalScannerPage from '../app/(authed)/portal/scanner/page';
import { ComingSoon } from './coming-soon';

/**
 * Reserved-route placeholder tests (Task 74) — the spec's list: each route
 * renders its title and CTA (and the legal stubs render the verbatim body
 * with NO CTA — nothing is invented).
 */

describe('ComingSoon', () => {
  it('renders the eyebrow, title, body and the optional CTA', () => {
    render(
      <ComingSoon
        eyebrow="Eyebrow Text"
        title="Placeholder Title"
        body="Placeholder body copy."
        cta={{ label: 'Go somewhere', href: '/somewhere' }}
      />,
    );
    expect(screen.getByText('Eyebrow Text')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Placeholder Title' })).toBeInTheDocument();
    expect(screen.getByText('Placeholder body copy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go somewhere' })).toHaveAttribute(
      'href',
      '/somewhere',
    );
  });

  it('renders no button without a cta', () => {
    render(<ComingSoon eyebrow="E" title="T" body="B" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('reserved portal routes', () => {
  it('/portal/academy renders its title and CTA', () => {
    render(<PortalAcademyPage />);
    expect(screen.getByRole('heading', { name: 'Academy Progress' })).toBeInTheDocument();
    expect(screen.getByText('Academy')).toBeInTheDocument();
    expect(
      screen.getByText('Your learning tracks and certificates will appear here.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tracks' })).toHaveAttribute('href', '/academy');
  });

  it('/portal/scanner renders its title and the public-site anchor CTA', () => {
    render(<PortalScannerPage />);
    expect(screen.getByRole('heading', { name: 'Free Vulnerability Scanner' })).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Run a quick reconnaissance simulation from the public site, or request a full authorised assessment.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the scanner' })).toHaveAttribute(
      'href',
      '/#free-scanner',
    );
  });
});

describe('reserved marketing routes', () => {
  it('/academy renders its title and CTA', () => {
    render(<MarketingAcademyPage />);
    expect(screen.getByRole('heading', { name: 'VUNVAULT Academy' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Structured, hands-on cyber training with free certificates. Course pages are coming soon.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it.each([
    ['/cookie-policy', CookiePolicyPage, 'Cookie Policy'],
    ['/privacy', PrivacyPolicyPage, 'Privacy Policy'],
    ['/terms', TermsOfServicePage, 'Terms of Service'],
  ] as const)('%s renders the legal stub with no CTA', (_route, Page, title) => {
    render(<Page />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(
      screen.getByText('This document is being finalised. Contact info@vunvault.com for a copy.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

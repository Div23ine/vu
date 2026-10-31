// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CookiePolicyPage from './cookie-policy/page';
import PrivacyPolicyPage from './privacy/page';
import ResponsibleDisclosurePage from './responsible-disclosure/page';
import TermsOfServicePage from './terms/page';

/**
 * Legal pages — the published documents the footer, the consent banner and
 * the versioned consent gate all point at. The suites pin the statutory
 * references each document must carry so a future edit cannot quietly drop
 * the regimes the policy is written against.
 */

describe('Privacy Policy', () => {
  it('names the regimes, the controller and the rights framework', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Regulation \(EU\) 2016\/679/)).toBeInTheDocument();
    expect(screen.getByText(/Privacy Act 1988 \(Cth\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Data Protection Act, 2019/).length).toBeGreaterThan(0);
    expect(screen.getByText(/ePrivacy Directive \(2002\/58\/EC\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/CCPA\/CPRA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('privacy@vunvault.com').length).toBeGreaterThan(0);
    expect(screen.getByText(/Art\. 33/)).toBeInTheDocument();
  });
});

describe('Terms of Service', () => {
  it('carries the consumer-protection regimes and the liability framework', () => {
    render(<TermsOfServicePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText(/Australian Consumer Law/)).toBeInTheDocument();
    expect(screen.getByText(/Directive 93\/13\/EEC/)).toBeInTheDocument();
    expect(screen.getByText(/Computer Misuse Act 1990/)).toBeInTheDocument();
    expect(screen.getByText(/Rome I/)).toBeInTheDocument();
  });
});

describe('Cookie Policy', () => {
  it('tables every cookie the platform sets, with lifetimes', () => {
    render(<CookiePolicyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cookie Policy' })).toBeInTheDocument();
    for (const name of ['vv_consent', 'vv_anon', 'vv_at', 'vv_rt', 'vv_mfa', 'vv_csrf']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Art\. 5\(3\) of the ePrivacy Directive/)).toBeInTheDocument();
  });
});

describe('Responsible Disclosure', () => {
  it('publishes the channel, the PGP fingerprint and the safe-harbour promise', () => {
    render(<ResponsibleDisclosurePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Responsible Disclosure' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3B99 FC12 8A4D 55E0 91C7')).toBeInTheDocument();
    expect(screen.getByText(/ISO\/IEC 29147:2020/)).toBeInTheDocument();
    expect(screen.getAllByText(/Safe harbour/).length).toBeGreaterThan(0);
  });
});

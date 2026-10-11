// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatUsdWhole } from '@vunvault/lib';
import { AcademyTracks } from './academy-tracks';
import { PLANS, PLANS_FOOTNOTE } from '../pricing-data';
import { PricingPlans } from '../pricing-plans';

/**
 * Academy + Pricing tests (Task 51). Both sections are static server
 * components, so the suites render them bare and pin the verbatim copy, the
 * price formatting path and the featured-plan treatment.
 */

describe('PricingPlans', () => {
  it('renders three plan cards with the exact price strings', () => {
    render(<PricingPlans />);
    expect(PLANS).toHaveLength(3);
    expect(screen.getByText('$299')).toBeInTheDocument();
    expect(screen.getByText('/ scan')).toBeInTheDocument();
    expect(screen.getByText('$899')).toBeInTheDocument();
    expect(screen.getByText('/ assessment')).toBeInTheDocument();
    expect(screen.getByText('$2,499')).toBeInTheDocument();
    expect(screen.getByText('/ month')).toBeInTheDocument();

    for (const plan of PLANS) {
      expect(screen.getByRole('heading', { name: plan.name })).toBeInTheDocument();
      expect(screen.getByText(plan.description)).toBeInTheDocument();
      for (const feature of plan.features) {
        expect(screen.getByText(feature)).toBeInTheDocument();
      }
    }
  });

  it('produces the price strings through formatUsdWhole', () => {
    expect(formatUsdWhole(29_900)).toBe('$299');
    expect(formatUsdWhole(89_900)).toBe('$899');
    expect(formatUsdWhole(249_900)).toBe('$2,499');
  });

  it('marks the SACCO & Fintech card as featured with the Recommended tag', () => {
    render(<PricingPlans />);
    const featured = document.querySelectorAll('.vv-plan--featured');
    expect(featured).toHaveLength(1);
    const card = featured[0];
    if (card === undefined) throw new Error('Featured plan card is missing.');
    expect(
      within(card as HTMLElement).getByRole('heading', { name: 'SACCO & Fintech Compliance' }),
    ).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('Recommended')).toBeInTheDocument();
    // The other two carry their own tags.
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Retainer')).toBeInTheDocument();
  });

  it('links every Learn More to /services#pricing and shows the section furniture', () => {
    render(<PricingPlans />);
    const ctas = screen.getAllByRole('link', { name: /Learn More/ });
    expect(ctas).toHaveLength(3);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('href', '/services#pricing');
    }
    expect(screen.getByText('Plans & Pricing')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Accessible security pricing for African & global tech',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'High-impact penetration testing and vulnerability assessments at balanced, competitive starting rates.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(PLANS_FOOTNOTE)).toBeInTheDocument();
    expect(document.getElementById('pricing')).not.toBeNull();
    expect(document.getElementById('services-plans')).not.toBeNull();
  });
});

describe('AcademyTracks', () => {
  it('renders the three tracks verbatim', () => {
    render(<AcademyTracks />);
    expect(screen.getByText('VUNVAULT Academy')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Learning tracks built for the real threat landscape',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Structured, hands-on curriculum for defenders, analysts and offensive engineers with free certificate.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Foundations')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Networking & Defense Foundations' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Blue Team')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'SOC Analyst & Incident Response' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Red Team')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ethical Hacking & Web Pentesting' }),
    ).toBeInTheDocument();

    expect(document.querySelectorAll('article.vv-track')).toHaveLength(3);
    const ctas = screen.getAllByRole('link', { name: /Explore Track/ });
    expect(ctas).toHaveLength(3);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('href', '/academy');
    }
  });

  it('renders every skill chip', () => {
    render(<AcademyTracks />);
    // The markup embeds four chips per track (twelve total); the catalogue's
    // test note says "nine" but the verbatim markup wins.
    const chips = [
      'TCP/IP',
      'DNS & TLS',
      'Firewalls',
      'Hardening',
      'SIEM',
      'Threat Hunting',
      'DFIR',
      'MITRE ATT&CK',
      'OWASP Top 10',
      'Burp Suite',
      'API Security',
      'Reporting',
    ];
    for (const chip of chips) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
    expect(document.querySelectorAll('.vv-skill')).toHaveLength(chips.length);
  });
});

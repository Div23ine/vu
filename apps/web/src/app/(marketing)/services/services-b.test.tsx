// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PLANS } from '../_components/pricing-data';
import { RequestBand } from './_components/request-band';
import { ServicesPricing } from './_components/services-pricing';

/**
 * Services page B tests .
 *
 * Per the spec's Behaviour + Tests (see the component header for the
 * resolved markup conflict): the section renders the three shared an earlier iteration
 * plans — `$299`, `$899`, `$2,499` — and every CTA carries the
 * penetration-testing category query.
 */

const CONTACT_HREF = '/contact?category=penetration_testing_request#contact-form';

describe('ServicesPricing', () => {
  it('shows the three shared plans with their exact price strings', () => {
    render(<ServicesPricing />);
    expect(PLANS).toHaveLength(3);
    expect(screen.getByText('$299')).toBeInTheDocument();
    expect(screen.getByText('$899')).toBeInTheDocument();
    expect(screen.getByText('$2,499')).toBeInTheDocument();
    expect(screen.getByText('/ scan')).toBeInTheDocument();
    expect(screen.getByText('/ assessment')).toBeInTheDocument();
    expect(screen.getByText('/ month')).toBeInTheDocument();
    expect(document.querySelectorAll('article.vv-plan')).toHaveLength(3);
  });

  it('renders the services header and footnote verbatim', () => {
    render(<ServicesPricing />);
    expect(screen.getByText('Plans & Pricing')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Transparent scope. Transparent pricing.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Every tier below lists exactly what is tested, what you receive and how long it takes. No hidden line items, no vague "from" pricing.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'All tiers include encrypted report delivery, a named engagement lead and a rules-of-engagement document signed under mutual NDA. Prices exclude applicable taxes. Re-test windows are measured from the date the final report is delivered.',
      ),
    ).toBeInTheDocument();
    expect(document.getElementById('pricing')).not.toBeNull();
    expect(document.getElementById('services-plans')).not.toBeNull();
  });

  it('marks the SACCO plan featured and labels the CTAs per the behaviour spec', () => {
    render(<ServicesPricing />);
    const featured = document.querySelectorAll('.vv-plan--featured');
    expect(featured).toHaveLength(1);
    expect(featured[0]?.textContent).toContain('SACCO & Fintech Compliance');

    expect(screen.getByRole('link', { name: /Start with Starter/ })).toHaveAttribute(
      'href',
      CONTACT_HREF,
    );
    const requestLinks = screen.getAllByRole('link', { name: /Request Assessment/ });
    expect(requestLinks).toHaveLength(2);
    for (const link of requestLinks) {
      expect(link).toHaveAttribute('href', CONTACT_HREF);
    }
  });

  it('every plan CTA carries the category query', () => {
    render(<ServicesPricing />);
    const ctas = document.querySelectorAll('a.vv-plan-cta');
    expect(ctas).toHaveLength(3);
    for (const cta of Array.from(ctas)) {
      expect(cta.getAttribute('href')).toBe(CONTACT_HREF);
    }
  });
});

describe('RequestBand', () => {
  it('renders the band heading verbatim and both contacts', () => {
    render(<RequestBand />);
    expect(screen.getByText('Next step')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Request an assessment under mutual NDA' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Send us your target scope, compliance deadline and preferred timeline. We reply with a written scope, rules-of-engagement draft and a fixed quote — usually within one business day.',
      ),
    ).toBeInTheDocument();

    const mailto = screen.getByRole('link', { name: /Email info@vunvault.com/ });
    expect(mailto).toHaveAttribute(
      'href',
      'mailto:info@vunvault.com?subject=Assessment%20Request%20%E2%80%94%20VUNVAULT',
    );
    const whatsapp = screen.getByRole('link', { name: /WhatsApp \+254 705 998 032/ });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/254705998032');
    expect(whatsapp).toHaveAttribute('target', '_blank');

    expect(
      screen.getByText('NDA on request · Scope before invoice · No data retained'),
    ).toBeInTheDocument();
    expect(document.getElementById('request-assessment')).not.toBeNull();
  });
});

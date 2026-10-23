import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HOME_QA } from '../qa-data';
import { QaSection } from './qa-section';

/**
 * Home Q&A band — the retired /pricing page's buyer content, re-cut as
 * disclosures. Every entry renders closed (no surprise walls of text), the
 * section carries its own labelled h2, and the money line repeats the
 * USD-settlement rule verbatim.
 */

describe('QaSection', () => {
  it('renders the labelled heading and every home Q&A as a closed disclosure', () => {
    render(<QaSection />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Questions buyers actually ask' }),
    ).toBeInTheDocument();

    const disclosures = document.querySelectorAll('details');
    expect(disclosures).toHaveLength(HOME_QA.length);
    for (const details of disclosures) {
      expect(details).not.toHaveAttribute('open');
    }
    for (const entry of HOME_QA) {
      expect(screen.getByText(entry.q)).toBeInTheDocument();
    }
  });

  it('keeps the USD settlement rule on the page', () => {
    render(<QaSection />);
    expect(
      screen.getByText(/Prices settle in USD; local-currency figures anywhere on this site/),
    ).toBeInTheDocument();
  });
});

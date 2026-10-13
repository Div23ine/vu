// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CveTicker } from '../cve-ticker';
import { HERO_METRICS, TICKER_ITEMS } from './home-data';
import { Hero } from './hero';

/**
 * Home hero + CVE ticker tests (Task 47). Both are server components with
 * static data, so the tests render them bare — no providers, no mocks.
 */

describe('Hero', () => {
  it('renders the verbatim headline, eyebrow, CTA and status', () => {
    render(<Hero />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'We Find The Cracks Before They Do' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Africa-rooted · Worldwide defense')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '#get-started',
    );
    expect(screen.getByText('SYSTEM STATUS: SECURE')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Live Attack Surface' }),
    ).toBeInTheDocument();
    expect(screen.getByText('VUNVAULT')).toBeInTheDocument();
  });

  it('renders the three hero metrics', () => {
    render(<Hero />);
    for (const metric of HERO_METRICS) {
      expect(screen.getByText(metric.label)).toBeInTheDocument();
      expect(screen.getByText(metric.value)).toBeInTheDocument();
    }
    expect(screen.getByText('Nodes Monitored')).toBeInTheDocument();
    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('Threats Blocked')).toBeInTheDocument();
    expect(screen.getByText('12,904')).toBeInTheDocument();
    expect(screen.getByText('Mean Patch Time')).toBeInTheDocument();
    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });

  it('renders the network map as an accessible image with all six nodes', () => {
    render(<Hero />);
    const map = screen.getByRole('img', { name: 'Live map of protected network nodes' });
    expect(map).toBeInTheDocument();
    for (const node of [
      'API Gateway',
      'Core K8s',
      'Identity',
      'Edge CDN',
      'DB Replica',
      'Backup Vault',
    ]) {
      expect(screen.getByText(node)).toBeInTheDocument();
    }
  });
});

describe('CveTicker', () => {
  it('shows the four unique CVEs, duplicated for the loop', () => {
    render(<CveTicker />);
    expect(TICKER_ITEMS).toHaveLength(4);
    for (const item of TICKER_ITEMS) {
      expect(screen.getAllByText(item.cve)).toHaveLength(2);
      expect(screen.getAllByText(item.text)).toHaveLength(2);
    }
  });

  it('exposes only one copy of each item to assistive tech', () => {
    render(<CveTicker />);
    for (const item of TICKER_ITEMS) {
      const copies = screen.getAllByText(item.cve);
      const exposed = copies.filter((element) => element.closest('[aria-hidden="true"]') === null);
      expect(exposed).toHaveLength(1);
    }
  });

  it('renders the verbatim severity badges', () => {
    render(<CveTicker />);
    expect(screen.getAllByText('CRITICAL')).toHaveLength(2);
    expect(screen.getAllByText('HIGH')).toHaveLength(4); // two items carry HIGH
    expect(screen.getAllByText('MEDIUM')).toHaveLength(2);
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import HomePage from './page';

/**
 * Home route assembly test (Task 52).
 *
 * Renders the whole page (inside a QueryClientProvider for the insights grid)
 * and pins what the assembly is actually about: the section ORDER, the
 * `#get-started` anchor, unique element ids across every section, and the
 * deletion of Task 41's placeholder route file.
 */

const EXPECTED_H1_H2_SEQUENCE = [
  'We Find The Cracks Before They Do',
  'Live Attack Surface',
  'We Offer a Free Vulnerability Scan — Scan Now',
  'Every login page, API and subdomain is a door. We map them all.',
  'From the VUNVAULT News & Blog',
  'How Can VUNVAULT Help You?',
  'Proactive Security Ecosystem',
  'Learning tracks built for the real threat landscape',
  'Accessible security pricing for African & global tech',
  'For journalists and partners',
  'The people behind the defense',
  'Get in Touch with VUNVAULT',
];

function renderPage() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe('home route assembly', () => {
  it('renders every section heading in the prototype order', () => {
    renderPage();
    const headings = screen
      .getAllByRole('heading')
      .filter((heading) => heading.tagName === 'H1' || heading.tagName === 'H2')
      .map((heading) => heading.textContent ?? '');
    expect(headings).toEqual(EXPECTED_H1_H2_SEQUENCE);
  });

  it('carries the #get-started anchor and points the hero CTA at it', () => {
    renderPage();
    const anchor = document.getElementById('get-started');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveClass('anchor-offset');
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '#get-started',
    );
  });

  it('assembles the ecosystem band: widget, side cards and the soft-protection line', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Zero-Day Exploit Tracking Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Security Advisory' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Get advice/ })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('heading', { name: 'Network Mapping' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore mapping/ })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(screen.getByText('Selected Node:')).toBeInTheDocument();
    expect(screen.getByText('Core-K8s')).toBeInTheDocument();
    expect(screen.getByText('Auto-Discovered')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Soft Protection for Hard Data.' }),
    ).toBeInTheDocument();
    // No photographs: the prototype's soft1.jpg is deliberately absent.
    expect(document.querySelector('img[src="soft1.jpg"]')).toBeNull();
  });

  it('renders four contributor cards and the ticker inside the full page', () => {
    renderPage();
    expect(document.querySelectorAll('article.contributor-card')).toHaveLength(4);
    expect(screen.getAllByText('CVE-2026-9122').length).toBeGreaterThan(0);
  });

  it('has no duplicate element ids across the assembled page', () => {
    renderPage();
    const ids = Array.from(document.querySelectorAll('[id]')).map((element) => element.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });

  it('the Task 41 placeholder route file no longer exists', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/page.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/app/(marketing)/page.tsx'))).toBe(true);
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from './page';
import { AboutHero } from './_components/about-hero';
import { MissionVision } from './_components/mission-vision';
import { Pillars } from './_components/pillars';

/**
 * About page A tests (Task 53). jsdom has no IntersectionObserver, so the
 * reveal hook keeps every section in its visible (unarmed) state — exactly
 * the no-JS/reduced-motion behaviour the catalogue requires.
 */

describe('AboutHero', () => {
  it('renders the verbatim hero copy, CTAs and stat strip', () => {
    render(<AboutHero />);
    expect(screen.getByText('Africa-rooted · Worldwide defense')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'We were built where the internet is hardest to defend.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/VUNVAULT is a Nairobi-headquartered offensive security firm/),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Explore Our Services' })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute(
      'href',
      '/contact',
    );

    const stats = [
      ['412', 'Sensors Online'],
      ['1,284', 'Assets Monitored'],
      ['12,904', 'Threats Blocked'],
      ['1.2s', 'Mean Patch Time'],
    ] as const;
    for (const [value, label] of stats) {
      expect(screen.getByText(value)).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe('MissionVision', () => {
  it('renders the mission and vision headings and copy verbatim', () => {
    render(<MissionVision />);
    expect(screen.getByText('Mission & Vision')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Security work that survives contact with reality.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Our mission' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Our vision' })).toBeInTheDocument();
    expect(
      screen.getByText(/To make advanced offensive security reachable for the institutions/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'We do not sell fear. We map exposure, prove impact, and hand back a prioritised path out of the blast radius.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A continent where a two-person IT team in Kisumu/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'We are building the sensor network, the academy and the tooling to close that gap permanently.',
      ),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('.vv-mv-card')).toHaveLength(2);
    expect(document.querySelectorAll('.vv-mv-card--dark')).toHaveLength(1);
  });
});

describe('Pillars', () => {
  it('renders three pillars, each with its bullet list', () => {
    render(<Pillars />);
    expect(screen.getByText('Core Pillars')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Three disciplines. One engagement.' }),
    ).toBeInTheDocument();

    const expected = [
      [
        'Precision Offense',
        [
          'Web, API and mobile penetration testing',
          'Custom fuzzing pipelines & zero-day research',
          'Purple-team validation against your SIEM rules',
        ],
      ],
      [
        'Regulatory Mastery',
        [
          'Central Bank of Kenya cyber requirements',
          'Kenya Data Protection Act & GDPR alignment',
          'ISO 27001 / SOC 2 control evidence',
        ],
      ],
      [
        'Capacity Building',
        [
          'VUNVAULT Academy learning tracks',
          'Developer secure-coding workshops',
          'Incident-response tabletop exercises',
        ],
      ],
    ] as const;

    const pillars = document.querySelectorAll('article.vv-pillar');
    expect(pillars).toHaveLength(3);
    for (const [title, items] of expected) {
      const heading = screen.getByRole('heading', { name: title });
      const card = heading.closest('article.vv-pillar');
      if (card === null) throw new Error(`Pillar card for ${title} is missing.`);
      for (const item of items) {
        expect(within(card as HTMLElement).getByText(item)).toBeInTheDocument();
      }
    }
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });
});

describe('AboutPage assembly', () => {
  it('renders every section in order (team + telemetry since Task 53b)', () => {
    const { container } = render(<AboutPage />);
    const headings = screen
      .getAllByRole('heading')
      .filter((heading) => heading.tagName === 'H1' || heading.tagName === 'H2')
      .map((heading) => heading.textContent ?? '');
    expect(headings).toEqual([
      'We were built where the internet is hardest to defend.',
      'Security work that survives contact with reality.',
      'Three disciplines. One engagement.',
      'The people behind the defense.',
      'What our sensors are seeing right now.',
      'See your attack surface the way we see it.',
    ]);
    // Task 53b replaced the two stubs with the team + telemetry sections.
    expect(container.querySelectorAll('section')).toHaveLength(6);
    expect(document.getElementById('mission')).not.toBeNull();
    expect(document.getElementById('pillars')).not.toBeNull();
    expect(document.getElementById('get-started')).not.toBeNull();
  });

  it('routes the closing CTAs per the catalogue', () => {
    render(<AboutPage />);
    expect(screen.getByRole('link', { name: 'Explore Services' })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(screen.getByRole('link', { name: 'Book a Scoping Call' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByText('No cost · No commitment')).toBeInTheDocument();
    expect(screen.getByText(/Start with a free external vulnerability scan/)).toBeInTheDocument();
  });
});

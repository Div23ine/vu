// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEAM_MEMBERS, TELEMETRY_ALERTS } from './_data/about-data';
import AboutPage from './page';
import { AboutTeam } from './_components/team';
import { AboutTelemetry } from './_components/telemetry';

/**
 * About page B tests — the team roster and the telemetry panel.
 * The panel runs on fake timers with a pinned clock, so the tick, countdown,
 * rotation, flash and teardown are deterministic (same contract as an earlier iteration).
 */

function feed(): HTMLElement {
  const element = document.getElementById('vv-tel-feed');
  if (element === null) throw new Error('Telemetry feed is not rendered.');
  return element;
}

function alertCves(): (string | null)[] {
  return within(feed())
    .getAllByRole('article')
    .map((row) => row.querySelector('.font-mono')?.textContent ?? null);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AboutTeam', () => {
  it('renders the six roster cards with photographs', () => {
    render(<AboutTeam />);
    expect(screen.getByText('Contributors & Core Team')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'The people behind the defense.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Every engagement is staffed by the people below — not subcontracted, not anonymised behind a logo.',
      ),
    ).toBeInTheDocument();

    expect(TEAM_MEMBERS).toHaveLength(8);
    expect(document.querySelectorAll('article.vv-team-card')).toHaveLength(6);
    // The initials tiles are gone — every avatar is a photograph.
    expect(document.querySelectorAll('.vv-team-initials')).toHaveLength(0);

    for (const member of TEAM_MEMBERS) {
      const heading = screen.getByRole('heading', { name: member.name });
      const card = heading.closest('article.vv-team-card');
      if (card === null) throw new Error(`Team card for ${member.name} is missing.`);
      const within_ = within(card as HTMLElement);
      expect(within_.getByText(member.role)).toBeInTheDocument();
      expect(within_.getByRole('img')).toHaveAttribute('src', member.photo);

      // Optional sections render only when the member has the data.
      if (member.bio) {
        expect(within_.getByText(member.bio)).toBeInTheDocument();
      } else {
        expect(card.querySelector('.vv-team-bio')).toBeNull();
      }
      for (const badge of member.badges ?? []) {
        expect(within_.getByText(badge.label, { selector: '.vv-team-badge' })).toBeInTheDocument();
      }
      if ((member.badges?.length ?? 0) === 0) {
        expect(card.querySelector('.vv-team-badges')).toBeNull();
      }
      for (const skill of member.skills ?? []) {
        expect(within_.getByText(skill, { selector: '.vv-team-skill' })).toBeInTheDocument();
      }
      if ((member.skills?.length ?? 0) === 0) {
        expect(card.querySelector('.vv-team-skills')).toBeNull();
      }
    }
  });

  it('renders no /team/* anchors — the design routes do not exist', () => {
    render(<AboutTeam />);
    expect(document.querySelectorAll('a[href^="/team"]')).toHaveLength(0);
    const first = TEAM_MEMBERS[0];
    const last = TEAM_MEMBERS[TEAM_MEMBERS.length - 1];
    if (first === undefined || last === undefined) throw new Error('Roster is empty.');
    // The social buttons go to the company profiles.
    expect(screen.getByRole('link', { name: `${first.name} on GitHub` })).toHaveAttribute(
      'href',
      'https://github.com/vunvault',
    );
    expect(screen.getByRole('link', { name: `${last.name} on LinkedIn` })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/company/vunvault',
    );
  });
});

describe('AboutTelemetry', () => {
  it('renders the panel furniture verbatim', () => {
    render(<AboutTelemetry />);
    expect(screen.getByText('System Telemetry')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What our sensors are seeing right now.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('VUNVAULT Sensor Network')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Real-Time Security Alerts')).toBeInTheDocument();
    expect(screen.getByText('Status Counters')).toBeInTheDocument();
    expect(screen.getByText('Patch Coverage')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Patch coverage' })).toHaveAttribute(
      'aria-valuenow',
      '68',
    );
    // Metric cards + counters.
    expect(screen.getByText('Sensors Online')).toBeInTheDocument();
    expect(screen.getByText('All nodes nominal')).toBeInTheDocument();
    expect(screen.getByText('▲ 36 this week')).toBeInTheDocument();
    expect(screen.getByText('Rolling 30-day window')).toBeInTheDocument();
    expect(screen.getByText('Client estates covered')).toBeInTheDocument();
    expect(screen.getByText('37,910')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Refreshed continuously from NVD, vendor advisories and the VUNVAULT sensor network. Times shown in UTC. Telemetry is aggregated and contains no client-identifying data.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the placeholder clock until mounted, then ticks', () => {
    render(<AboutTelemetry />);
    const clock = document.getElementById('vv-tel-clock');
    // The effect has run by now (fake timers pinned to 12:00:00Z).
    expect(clock?.textContent).toBe('12:00:00 UTC');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(clock?.textContent).toBe('12:00:01 UTC');
  });

  it('renders all six alerts and rotates the last row to the top after 8s', () => {
    render(<AboutTelemetry />);
    expect(TELEMETRY_ALERTS).toHaveLength(6);
    expect(within(feed()).getAllByRole('article')).toHaveLength(6);

    const first = TELEMETRY_ALERTS[0];
    const last = TELEMETRY_ALERTS[TELEMETRY_ALERTS.length - 1];
    if (first === undefined || last === undefined) throw new Error('Alert fixture is empty.');

    expect(alertCves()[0]).toBe(first.cve);
    expect(document.getElementById('vv-tel-countdown')?.textContent?.trim()).toBe('8s');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(document.getElementById('vv-tel-countdown')?.textContent?.trim()).toBe('5s');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(alertCves()[0]).toBe(last.cve); // CVE-2025-18820 now first
    expect(document.getElementById('vv-tel-countdown')?.textContent?.trim()).toBe('8s');

    // The moved row flashes for 1.2s.
    const movedRow = within(feed()).getAllByRole('article')[0];
    expect(movedRow).toHaveClass('is-flash');
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(within(feed()).getAllByRole('article')[0]).not.toHaveClass('is-flash');
  });

  it('clears every timer on unmount', () => {
    const view = render(<AboutTelemetry />);
    act(() => {
      vi.advanceTimersByTime(8000); // rotation arms the flash timeout
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('AboutPage with the replaced stubs', () => {
  it('renders team and telemetry between the pillars and the CTA', () => {
    render(<AboutPage />);
    const sections = Array.from(document.querySelectorAll('section[id]')).map(
      (section) => section.id,
    );
    expect(sections).toEqual(['mission', 'pillars', 'contributors', 'telemetry', 'get-started']);
  });
});

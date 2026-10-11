// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZERO_DAY_FEED, ZERO_DAY_FOOTNOTE } from './zero-day-data';
import { ZeroDayWidget } from './zero-day-widget';

/**
 * Zero-Day widget tests (Task 50) — everything runs on fake timers with a
 * pinned UTC clock, so the tick, the countdown, the rotation, the flash and
 * the teardown are all deterministic.
 */

const FEED_ID = 'zdet-feed';

function feed(): HTMLElement {
  const element = document.getElementById(FEED_ID);
  if (element === null) throw new Error('Feed container is not rendered.');
  return element;
}

function countdownText(): string {
  const element = document.getElementById('zdet-countdown');
  return element?.textContent ?? '';
}

function clockText(): string {
  return document.getElementById('zdet-clock')?.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ZeroDayWidget', () => {
  it('renders the verbatim chrome, stats, tabs, status panel and footnote', () => {
    render(<ZeroDayWidget />);

    expect(
      screen.getByRole('heading', { name: 'Zero-Day Exploit Tracking Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Zero-Day Exploit Tracking')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('ER')).toBeInTheDocument();
    expect(screen.getByText('Dr. Evelyn Reed')).toBeInTheDocument();

    for (const tab of [
      'Dashboard',
      'Live Feed',
      'Exploit DB',
      'Patch Status',
      'Vendors',
      'Reports',
    ]) {
      expect(screen.getByRole('button', { name: tab })).toBeInTheDocument();
    }

    expect(screen.getByText('Total Active Zero-Days')).toBeInTheDocument();
    // '1,284' appears twice by design: the stat card and the status counter.
    expect(screen.getAllByText('1,284')).toHaveLength(2);
    expect(screen.getByText('▲ 62 this week')).toBeInTheDocument();
    expect(screen.getByText('Weaponized in the Wild')).toBeInTheDocument();
    expect(screen.getByText('● Active exploitation')).toBeInTheDocument();
    expect(screen.getByText('Patched Vulnerabilities')).toBeInTheDocument();
    expect(screen.getByText('37,910')).toBeInTheDocument();
    expect(screen.getByText('▼ 18% open backlog')).toBeInTheDocument();
    expect(screen.getByText('Mean Time to Patch')).toBeInTheDocument();
    expect(screen.getByText('Automated validation')).toBeInTheDocument();

    expect(screen.getByText('Tracking System Status')).toBeInTheDocument();
    expect(screen.getByText('All Sensors Nominal')).toBeInTheDocument();
    expect(screen.getByText('Weaponized in Wild')).toBeInTheDocument();
    expect(screen.getByText('Critical Unpatched')).toBeInTheDocument();
    expect(screen.getByText('412 / 412')).toBeInTheDocument();
    expect(screen.getByText('Patch Coverage')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();

    for (const action of ['Run CVE Scan', 'Isolate Asset', 'Push Patch', 'Advisories']) {
      expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
    }

    expect(screen.getByText(ZERO_DAY_FOOTNOTE)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Refreshed continuously from NVD, vendor advisories and the VUNVAULT sensor network. Times shown in UTC.',
      ),
    ).toBeInTheDocument();
  });

  it('shows every fixture CVE exactly once, with chip, time and meta', () => {
    render(<ZeroDayWidget />);
    expect(ZERO_DAY_FEED).toHaveLength(6);
    for (const row of ZERO_DAY_FEED) {
      expect(screen.getAllByText(row.cve)).toHaveLength(1);
    }
    const first = ZERO_DAY_FEED[0];
    if (first === undefined) throw new Error('Feed fixture is empty.');
    expect(screen.getByText(first.time + ' UTC', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(first.meta)).toBeInTheDocument();
    // Two fixture rows are unpatched; three carry the Critical chip.
    expect(screen.getAllByText('● Unpatched')).toHaveLength(2);
    expect(screen.getAllByText('Critical')).toHaveLength(3);
  });

  it('ticks the UTC clock every second', () => {
    render(<ZeroDayWidget />);
    expect(clockText()).toBe('12:00:00 UTC');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(clockText()).toBe('12:00:01 UTC');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(clockText()).toBe('12:00:03 UTC');
  });

  it('counts down 8s…1s, then rotates the last row to the top and resets', () => {
    render(<ZeroDayWidget />);
    expect(countdownText()).toBe('8s');
    expect(document.getElementById('zdet-refreshed')?.textContent).toBe('Auto-refresh');

    const last = ZERO_DAY_FEED[ZERO_DAY_FEED.length - 1];
    if (last === undefined) throw new Error('Feed fixture is empty.');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(countdownText()).toBe('5s');

    // Five more ticks: the wrap rotates the feed.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(countdownText()).toBe('8s');

    const rows = within(feed()).getAllByRole('article');
    expect(rows[0]?.textContent).toContain(last.cve); // CVE-2026-1104 now first
    expect(rows).toHaveLength(6);

    // The rotated row flashes for 1.2s, then the class is removed.
    expect(rows[0]).toHaveClass('zdet-flash');
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(within(feed()).getAllByRole('article')[0]).not.toHaveClass('zdet-flash');

    expect(document.getElementById('zdet-refreshed')?.textContent).toMatch(
      /^Updated \d{2}:\d{2}:\d{2} UTC$/,
    );
  });

  it('clears every timer on unmount', () => {
    const view = render(<ZeroDayWidget />);
    act(() => {
      vi.advanceTimersByTime(8000); // rotation also arms the flash timeout
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

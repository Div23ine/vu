// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { INVALID_TARGET_LINE } from '../_components/scanner/use-scan-simulation';
import { CoreServices } from './_components/core-services';
import { InlineCli } from './_components/inline-cli';
import { SERVICE_TABS, ServiceTabs } from './_components/service-tabs';
import { ServicesHero } from './_components/services-hero';

/**
 * Services page A tests .
 *
 * The CLI reuses an earlier iteration's engine, so the scan assertions mirror the scanner
 * suite: invalid target → the exact engine error line; valid target → the
 * 19-step script under fake timers ending at COMPLETE / 100%.
 *
 * The spec's test note says "three core-service blocks"; the verbatim
 * markup embeds six cards (one shown + "+5 more siblings") — the markup wins.
 */

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('ServicesHero', () => {
  it('renders the verbatim hero and both CTAs', () => {
    render(<ServicesHero />);
    expect(screen.getByText('Enterprise Security Solutions')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Application penetration testing, surface reconnaissance and proactive threat mitigation.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/VUNVAULT combines manual, human-led penetration testing/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request Assessment' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByRole('link', { name: 'Try the free OSINT tools' })).toHaveAttribute(
      'href',
      '#free-tools',
    );
    for (const item of [
      'NDA-backed',
      'OWASP-aligned',
      'Central Bank ready',
      'Africa-rooted · Worldwide',
    ]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});

describe('CoreServices', () => {
  it('renders the six service cards with titles and tags', () => {
    render(<CoreServices />);
    expect(screen.getByText('Core Security Services')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Everything we test, and why it matters' }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('article.vv-svc-card')).toHaveLength(6);

    for (const title of [
      'Web Application Penetration Testing',
      'Attack Surface Reconnaissance',
      'WAF & Defense Verification',
      'IT & Network Troubleshooting',
      'Cloud & Mobile Security',
      'Compliance & Reporting',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    for (const tag of [
      'OWASP Top 10',
      'CT Logs',
      'Payload Stress',
      'DNS Diagnostics',
      'M-Pesa / Fintech',
      'Audit Evidence',
    ]) {
      expect(screen.getByText(tag)).toBeInTheDocument();
    }
  });
});

describe('ServiceTabs', () => {
  it('marks the first tab active and moves is-active on click', () => {
    render(<ServiceTabs />);
    expect(SERVICE_TABS).toHaveLength(4);
    const tabs = screen.getAllByRole('button');
    expect(tabs[0]).toHaveClass('is-active');

    fireEvent.click(screen.getByRole('button', { name: 'Core Services' }));
    expect(screen.getByRole('button', { name: 'Core Services' })).toHaveClass('is-active');
    expect(screen.getByRole('button', { name: 'Free Tools' })).not.toHaveClass('is-active');
    expect(tabs).toHaveLength(4);
  });
});

describe('InlineCli', () => {
  function cli() {
    const section = document.getElementById('free-tools');
    if (section === null) throw new Error('CLI section is not rendered.');
    return section;
  }

  it('renders the verbatim shell, tabs, chips and footnote', () => {
    render(<InlineCli />);
    expect(screen.getByText('Free Security Tools')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Run OSINT reconnaissance from your browser' }),
    ).toBeInTheDocument();
    expect(screen.getByText('vunvault-cli v2.4.0 — osint --interactive')).toBeInTheDocument();
    expect(screen.getByText('IDLE')).toBeInTheDocument();

    const tablist = screen.getByRole('tablist', { name: 'Free OSINT tools' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      '1 · IP / Reverse Lookup',
      '2 · DNS Record Tracer',
      '3 · IMEI / Device Registry',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveClass('is-active');

    expect(
      screen.getByText(
        'Resolves reverse DNS, WHOIS ownership and geolocation for a domain or IPv4 address.',
      ),
    ).toBeInTheDocument();
    for (const chip of ['example.com', '203.0.113.42', 'api.vunvault.com']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        'Simulated reconnaissance for demonstration purposes. Never query systems, addresses or device identifiers you do not own or have written authorisation to investigate.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Lookup progress' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });

  it('switching a tab sets is-active and swaps hint + chips', () => {
    render(<InlineCli />);
    fireEvent.click(screen.getByRole('tab', { name: '2 · DNS Record Tracer' }));
    expect(screen.getByRole('tab', { name: '2 · DNS Record Tracer' })).toHaveClass('is-active');
    expect(screen.getByRole('tab', { name: '2 · DNS Record Tracer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByText(
        'Checks A, AAAA, MX, TXT and NS records against global registries and flags policy weaknesses.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mail.example.com' })).toBeInTheDocument();
  });

  it('rejects an invalid target with the exact engine message', () => {
    vi.useFakeTimers();
    try {
      render(<InlineCli />);
      const input = screen.getByLabelText('Target value for the selected tool');
      fireEvent.change(input, { target: { value: 'not valid' } });
      fireEvent.submit(
        within(cli())
          .getByRole('button', { name: 'Execute Scan' })
          .closest('form') as HTMLFormElement,
      );

      const log = screen.getByRole('log', { name: 'Terminal output' });
      expect(log).toHaveTextContent(INVALID_TARGET_LINE);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveClass('is-invalid');
      expect(screen.getByText('IDLE')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('completes the 19-step scan under fake timers and reaches COMPLETE / 100%', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    try {
      render(<InlineCli />);
      const input = screen.getByLabelText('Target value for the selected tool');
      // A suggestion chip fills the input, as in the design.
      fireEvent.click(screen.getByRole('button', { name: 'api.vunvault.com' }));
      expect(input).toHaveValue('api.vunvault.com');

      fireEvent.submit(
        within(cli())
          .getByRole('button', { name: 'Execute Scan' })
          .closest('form') as HTMLFormElement,
      );
      expect(screen.getByText('SCANNING')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(20 * 260);
      });

      const log = screen.getByRole('log', { name: 'Terminal output' });
      expect(log.querySelectorAll('.vv-line')).toHaveLength(19);
      expect(log).toHaveTextContent(
        'vunvault-scanner-cli v2.4.0 — initialising reconnaissance engine',
      );
      expect(log).toHaveTextContent('> target: api.vunvault.com');
      expect(log).toHaveTextContent('scan complete in 4.28s');
      expect(screen.getByText('COMPLETE')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Lookup progress' })).toHaveAttribute(
        'aria-valuenow',
        '100',
      );

      // Clear resets to IDLE.
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(screen.getByText('IDLE')).toBeInTheDocument();
      expect(log.querySelectorAll('.vv-line')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

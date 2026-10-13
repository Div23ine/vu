// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScannerCta } from './scanner-cta';
import { ScannerDialog } from './scanner-dialog';
import { OPEN_SCANNER_EVENT, useScannerStore } from './scanner-store';
import { INVALID_TARGET_LINE } from './use-scan-simulation';

/**
 * Free Scanner tests (Task 48).
 *
 * The dialog is a Radix primitive wired to the deterministic simulation
 * engine, so the 19-step run is driven with fake timers and asserted line by
 * line. No network is involved anywhere — that is the point of the feature.
 */

beforeAll(() => {
  // Radix needs these browser APIs; jsdom does not implement them.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  useScannerStore.setState({ open: false });
  document.body.className = '';
  document.body.removeAttribute('style');
  document.body.removeAttribute('data-scroll-locked');
});

function renderScanner() {
  return render(
    <>
      <ScannerCta />
      <ScannerDialog />
    </>,
  );
}

const DIALOG_TITLE = 'vunvault-scanner-cli v2.4.0 — vvscan --interactive';

function scannerForm(dialog: HTMLElement): HTMLFormElement {
  const form = dialog.querySelector('form');
  if (form === null) throw new Error('Scanner form is not rendered.');
  return form;
}

describe('ScannerCta', () => {
  it('renders the verbatim band copy', () => {
    renderScanner();
    expect(screen.getByText('No cost · No commitment')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /We Offer a Free Vulnerability Scan —/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Scan Now')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Point us at a web application, API gateway or public IP range and watch our reconnaissance engine enumerate live exposure in real time. Evaluate your perimeter before an attacker does.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request Free Scan' })).toBeInTheDocument();
    expect(screen.getByText('Runs in your browser · Nothing is stored')).toBeInTheDocument();
  });

  it('opens the terminal dialog from the CTA button', async () => {
    const user = userEvent.setup();
    renderScanner();
    await user.click(screen.getByRole('button', { name: 'Request Free Scan' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: DIALOG_TITLE })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Simulated reconnaissance for demonstration purposes. Only scan systems you own or have written authorisation to test.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('IDLE')).toBeInTheDocument();
  });

  it(`opens from the ${OPEN_SCANNER_EVENT} window event (the footer's path)`, async () => {
    renderScanner();
    act(() => {
      window.dispatchEvent(new Event(OPEN_SCANNER_EVENT));
    });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape, and the traffic-light buttons keep their roles', async () => {
    const user = userEvent.setup();
    renderScanner();
    await user.click(screen.getByRole('button', { name: 'Request Free Scan' }));
    const dialog = await screen.findByRole('dialog');

    // Maximise toggles is-max on the window.
    await user.click(within(dialog).getByRole('button', { name: 'Maximize scanner' }));
    expect(dialog).toHaveClass('is-max');
    await user.click(within(dialog).getByRole('button', { name: 'Maximize scanner' }));
    expect(dialog).not.toHaveClass('is-max');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Minimise also closes (per the catalogue's dialog semantics).
    await user.click(screen.getByRole('button', { name: 'Request Free Scan' }));
    const reopened = await screen.findByRole('dialog');
    await user.click(within(reopened).getByRole('button', { name: 'Minimize scanner' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('scan simulation', () => {
  async function openDialog() {
    const user = userEvent.setup();
    renderScanner();
    await user.click(screen.getByRole('button', { name: 'Request Free Scan' }));
    return await screen.findByRole('dialog');
  }

  it('rejects an invalid target with the exact error line and marks the input', async () => {
    const dialog = await openDialog();
    const input = within(dialog).getByLabelText('Target IP address or domain name');
    const log = within(dialog).getByRole('log', { name: 'Scan output' });

    await userEvent.type(input, 'definitely-not-valid');
    fireEvent.submit(scannerForm(dialog));

    expect(log).toHaveTextContent(INVALID_TARGET_LINE);
    expect(log).toHaveTextContent(
      '[!] Invalid target. Enter a domain (example.com) or IPv4 address.',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('is-invalid');
    expect(within(dialog).getByText('IDLE')).toBeInTheDocument(); // never started
  });

  it('walks the 19 steps to COMPLETE at progress 100, and Clear returns to IDLE', async () => {
    const dialog = await openDialog();
    const input = within(dialog).getByLabelText('Target IP address or domain name');
    const log = within(dialog).getByRole('log', { name: 'Scan output' });
    const progress = within(dialog).getByRole('progressbar', { name: 'Scan progress' });

    vi.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: 'example.com' } });
      fireEvent.submit(scannerForm(dialog));
      expect(within(dialog).getByText('SCANNING')).toBeInTheDocument();

      // 19 steps at 260ms + the finishing tick.
      act(() => {
        vi.advanceTimersByTime(20 * 260);
      });

      expect(log.querySelectorAll('.vv-line')).toHaveLength(19);
      expect(log).toHaveTextContent(
        'vunvault-scanner-cli v2.4.0 — initialising reconnaissance engine',
      );
      expect(log).toHaveTextContent('> target: example.com');
      expect(log).toHaveTextContent('[CRITICAL] CVE-2026-9122 — RCE in API ingress (CVSS 9.8)');
      expect(log).toHaveTextContent('[+] Report ready. 3 findings — 1 critical, 1 high, 1 medium.');
      expect(log).toHaveTextContent('scan complete in 4.28s');
      expect(within(dialog).getByText('COMPLETE')).toBeInTheDocument();
      expect(progress).toHaveAttribute('aria-valuenow', '100');

      // Clear restores the idle state and empties the input and the log.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clear' }));
      expect(within(dialog).getByText('IDLE')).toBeInTheDocument();
      expect(log.querySelectorAll('.vv-line')).toHaveLength(0);
      expect(progress).toHaveAttribute('aria-valuenow', '0');
      expect(input).toHaveValue('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fills the input from a suggestion chip', async () => {
    const dialog = await openDialog();
    const input = within(dialog).getByLabelText('Target IP address or domain name');
    await userEvent.click(within(dialog).getByRole('button', { name: '192.168.1.1' }));
    expect(input).toHaveValue('192.168.1.1');
    expect(screen.getByRole('button', { name: 'example.com' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'api.vunvault.com' })).toBeInTheDocument();
  });
});

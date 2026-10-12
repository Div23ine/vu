// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FREE_RESOURCES, FREE_RESOURCES_FOOTNOTE } from './_data/free-resources';
import { CustomBand } from './_components/custom-band';
import { FreeResources } from './_components/free-resources';
import { ToolboxShell } from './_components/toolbox-shell';

/**
 * Products page B tests (Task 55b).
 *
 * The shell runs on fake timers: its `scan` delegates to Task 48's engine
 * (260 ms cadence), and COMPLETE falls back to READY after 2.6 s — both are
 * asserted deterministically here.
 */

const routerPush = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => '/products',
}));

function log(): HTMLElement {
  return screen.getByRole('log', { name: 'Interactive toolbox console output' });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
  routerPush.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FreeResources', () => {
  it('renders six cards with disabled download buttons', () => {
    render(<FreeResources />);
    expect(screen.getByText('Free Resources')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Open tooling, no licence required' }),
    ).toBeInTheDocument();
    expect(screen.getByText('6 Resources')).toBeInTheDocument();
    expect(FREE_RESOURCES).toHaveLength(6);

    for (const resource of FREE_RESOURCES) {
      expect(screen.getByRole('heading', { name: resource.name })).toBeInTheDocument();
      expect(screen.getByText(resource.description)).toBeInTheDocument();
      expect(screen.getByText(resource.size)).toBeInTheDocument();
      for (const tag of resource.tags) {
        expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
      }
    }

    const downloads = screen.getAllByRole('button', { name: /Download/ });
    expect(downloads).toHaveLength(6);
    for (const button of downloads) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute(
        'title',
        'Download links are published when the file is released',
      );
    }

    expect(screen.getByText(FREE_RESOURCES_FOOTNOTE)).toBeInTheDocument();
    expect(document.getElementById('free-resources')).not.toBeNull();
    expect(document.getElementById('free-tools')).not.toBeNull();
  });
});

describe('ToolboxShell', () => {
  it('boots with the banner and READY status', () => {
    render(<ToolboxShell />);
    expect(screen.getByText('Live Console')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Try the toolbox before you download it' }),
    ).toBeInTheDocument();
    expect(log()).toHaveTextContent('vunvault-toolbox v2.4.0 — interactive shell');
    expect(log()).toHaveTextContent('type "help" to list available commands');
    expect(screen.getByText('READY')).toBeInTheDocument();
    for (const chip of ['help', 'products', 'free', 'scan example.com', 'download cve-tracker']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    expect(screen.getByText(/Simulated environment for demonstration/)).toBeInTheDocument();
  });

  it('help lists every command verbatim', () => {
    render(<ToolboxShell />);
    fireEvent.click(screen.getByRole('button', { name: 'help' }));
    expect(log()).toHaveTextContent('VUNVAULT toolbox shell — available commands');
    for (const line of [
      ' help show this message',
      ' products list premium products',
      ' free list free resources',
      ' buy <id> open /portal/billing for a product',
      ' download <id> fetch a free resource',
      ' scan <target> run a simulated reconnaissance pass',
      ' about about this toolbox',
      ' clear clear the screen',
    ]) {
      expect(log()).toHaveTextContent(line);
    }
  });

  it('products lists the six-item premium catalogue', () => {
    render(<ToolboxShell />);
    fireEvent.click(screen.getByRole('button', { name: 'products' }));
    expect(log()).toHaveTextContent('[*] Premium catalog — 6 products');
    expect(log()).toHaveTextContent('ReconVault Pro');
    expect(log()).toHaveTextContent('$49');
    expect(log()).toHaveTextContent('ComplianceMapper');
    expect(log()).toHaveTextContent('$149');
    expect(log()).toHaveTextContent('[+] run `buy <id>` to open secure checkout');
  });

  it('free lists the six resources with the shell names', () => {
    render(<ToolboxShell />);
    fireEvent.click(screen.getByRole('button', { name: 'free' }));
    expect(log()).toHaveTextContent('[*] Free resources — 6 downloads');
    expect(log()).toHaveTextContent('Threat Intel Feed (JSON)');
    expect(log()).toHaveTextContent('Zero-Day Watch (RSS)');
    expect(log()).toHaveTextContent('[+] run `download <id>` to fetch a file');
  });

  it('rejects unknown commands verbatim', () => {
    render(<ToolboxShell />);
    const input = screen.getByLabelText('Enter a command');
    fireEvent.change(input, { target: { value: 'frobnicate' } });
    fireEvent.submit(document.getElementById('vv-term-form') as HTMLFormElement);
    expect(log()).toHaveTextContent('$ frobnicate');
    expect(log()).toHaveTextContent('[!] command not found: frobnicate');
    expect(log()).toHaveTextContent(' type `help` for the command list');
  });

  it('scan example.com runs the Task 48 engine to COMPLETE, then back to READY', () => {
    render(<ToolboxShell />);
    fireEvent.click(screen.getByRole('button', { name: 'scan example.com' }));
    expect(screen.getByText('SCANNING')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(20 * 260);
    });
    expect(log()).toHaveTextContent(
      'vunvault-scanner-cli v2.4.0 — initialising reconnaissance engine',
    );
    expect(log()).toHaveTextContent('> target: example.com');
    expect(log()).toHaveTextContent('scan complete in 4.28s');
    expect(screen.getByText('COMPLETE')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('buy announces the billing hand-off and navigates', () => {
    render(<ToolboxShell />);
    const input = screen.getByLabelText('Enter a command');
    fireEvent.change(input, { target: { value: 'buy reconvault' } });
    fireEvent.submit(document.getElementById('vv-term-form') as HTMLFormElement);
    expect(log()).toHaveTextContent('[*] redirecting to /portal/billing for ReconVault Pro …');

    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(routerPush).toHaveBeenCalledWith('/portal/billing');
  });

  it('download prints the verbatim lines for a known resource', () => {
    render(<ToolboxShell />);
    fireEvent.click(screen.getByRole('button', { name: 'download cve-tracker' }));
    expect(log()).toHaveTextContent('[+] fetching CVE Tracker CLI');
    expect(log()).toHaveTextContent(' source → downloads/vv-cve-tracker-cli-v1.4.0.zip');
  });

  it('Clear empties the log', () => {
    render(<ToolboxShell />);
    fireEvent.click(screen.getByRole('button', { name: 'help' }));
    expect(log().querySelectorAll('.vv-line').length).toBeGreaterThan(2);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(log().querySelectorAll('.vv-line')).toHaveLength(0);
  });
});

describe('CustomBand', () => {
  it('renders verbatim and links to /contact', async () => {
    render(<CustomBand />);
    expect(screen.getByText('Need something bespoke?')).toBeInTheDocument();
    expect(screen.getByText('We build custom tooling —')).toBeInTheDocument();
    expect(screen.getByText('Talk to an engineer')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Internal scanners, CI security gates, SIEM content or a private red-team arsenal. Tell us the workflow and we will scope the build.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start a Conversation/ })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByText('Nairobi-based · Serving clients worldwide')).toBeInTheDocument();
  });
});

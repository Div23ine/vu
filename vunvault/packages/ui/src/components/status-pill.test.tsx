// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusPill } from './status-pill';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe('StatusPill', () => {
  it('renders the default operational copy as a live region', () => {
    render(<StatusPill />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent('SYS: OPERATIONAL');
    expect(pill).toHaveClass('text-pill-ok-ink', 'bg-ok/10', 'border-ok/35', 'font-mono');
  });

  it('accepts a label override', () => {
    render(<StatusPill label="CHAIN: INTACT" />);
    expect(screen.getByRole('status')).toHaveTextContent('CHAIN: INTACT');
  });

  it('hides the animated ping ring from assistive technology', () => {
    const { container } = render(<StatusPill />);
    const ping = container.querySelector('.animate-vv-ping');
    expect(ping).not.toBeNull();
    expect(ping?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

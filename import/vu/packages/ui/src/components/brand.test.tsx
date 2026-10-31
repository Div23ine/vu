// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logo, LogoMark } from './logo';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
  vi.useRealTimers();
});

describe('Logo', () => {
  it('links home with an accessible name and the wordmark', () => {
    render(<Logo />);
    const link = screen.getByRole('link', { name: 'VUNVAULT home' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveClass('group', 'inline-flex', 'items-center', 'gap-3');
    expect(link).toHaveTextContent('VUNVAULT');
  });

  it('renders the operator-supplied mark, never an inline SVG', () => {
    render(<Logo />);
    const mark = screen.getByAltText('VUNVAULT');
    expect(mark).toHaveAttribute('src', '/brand/logo.svg');
    expect(mark).toHaveAttribute('width', '24');
    expect(mark).toHaveAttribute('height', '24');
    expect(mark).toHaveClass('object-contain');
    expect(mark.closest('span')).toHaveClass('bg-grad-tile', 'rounded-tile', 'shadow-tile');
  });

  it('accepts a custom href and src', () => {
    render(<Logo href="/portal" src="/brand/logo.svg?v=2" />);
    expect(screen.getByRole('link', { name: 'VUNVAULT home' })).toHaveAttribute('href', '/portal');
    expect(screen.getByAltText('VUNVAULT')).toHaveAttribute('src', '/brand/logo.svg?v=2');
  });

  it('switches the wordmark to white on dark headers', () => {
    const { rerender } = render(<Logo />);
    expect(screen.getByText('VUNVAULT')).toHaveClass('text-ink');
    rerender(<Logo tone="light" />);
    expect(screen.getByText('VUNVAULT')).toHaveClass('text-white');
  });
});

describe('LogoMark', () => {
  it('renders only the tile, labelled for assistive technology', () => {
    const { container } = render(<LogoMark />);
    // The tile carries the name; the `<img>` inside it repeats the alt text.
    const tile = container.querySelector<HTMLElement>('[role="img"][aria-label="VUNVAULT"]');
    expect(tile).not.toBeNull();
    expect(tile).toHaveClass('bg-grad-tile', 'border-brand/35');
    expect(screen.getByAltText('VUNVAULT')).toHaveAttribute('src', '/brand/logo.svg');
    expect(screen.queryByText('VUNVAULT')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

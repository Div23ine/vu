// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logo, LogoMark } from './logo';
import { Preloader } from './preloader';

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

describe('Preloader', () => {
  it('is a labelled live region with the product copy and structure', () => {
    const { container } = render(<Preloader />);
    const root = screen.getByRole('status', { name: 'Loading VUNVAULT' });
    expect(root).toHaveAttribute('aria-live', 'polite');
    expect(root).toHaveClass('vv-preloader');
    expect(screen.getByText('Establishing secure channel')).toHaveClass('vv-preloader__caption');
    expect(screen.getByText('VUNVAULT')).toHaveClass('vv-preloader__wordmark');

    const bar = screen.getByRole('progressbar', { name: 'Page loading progress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar.firstElementChild).toHaveClass('vv-preloader__fill');

    expect(container.querySelectorAll('.vv-preloader__ring')).toHaveLength(3);
    expect(container.querySelector('.vv-preloader__stage')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.vv-preloader__halo')).not.toBeNull();
    expect(screen.getByAltText('VUNVAULT Logo')).toHaveAttribute('src', '/brand/logo.svg');
  });

  it('fades after durationMs and unmounts 4700ms after mount, calling onDone', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(<Preloader onDone={onDone} />);
    const root = () => container.querySelector('.vv-preloader');

    expect(root()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(root()).not.toHaveClass('is-hidden');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(root()).toHaveClass('is-hidden');

    act(() => {
      vi.advanceTimersByTime(699);
    });
    expect(root()).not.toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(root()).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('honours a custom duration', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(<Preloader durationMs={1000} onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('.vv-preloader')).toHaveClass('is-hidden');
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(container.querySelector('.vv-preloader')).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('collapses the sequence to 800ms under prefers-reduced-motion', () => {
    vi.useFakeTimers();
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: ((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia,
    });

    const onDone = vi.fn();
    const { container } = render(<Preloader durationMs={4000} onDone={onDone} />);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(container.querySelector('.vv-preloader')).toHaveClass('is-hidden');
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(container.querySelector('.vv-preloader')).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: original,
    });
  });

  it('does not call onDone when unmounted early', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { unmount } = render(<Preloader onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDone).not.toHaveBeenCalled();
  });
});

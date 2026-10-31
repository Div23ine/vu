// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { Spinner } from './spinner';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe('Button', () => {
  it('renders the product copy as an accessible button', () => {
    render(<Button>Provision New Member</Button>);
    const button = screen.getByRole('button', { name: 'Provision New Member' });
    expect(button).toBeInTheDocument();
    // Defaults to type="button" so a stray click cannot submit an unrelated form.
    expect(button).toHaveAttribute('type', 'button');
  });

  it('applies the token classes for each variant', () => {
    render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="dark">Dark</Button>
        <Button variant="danger">Danger</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('bg-grad-brand');
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass('bg-white', 'text-ink');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveClass('text-white');
    expect(screen.getByRole('button', { name: 'Danger' })).toHaveClass('bg-critical');
  });

  it('applies the token classes for each size', () => {
    render(
      <>
        <Button size="md">Medium</Button>
        <Button size="sm">Small</Button>
        <Button size="icon" aria-label="Close dialog">
          <span aria-hidden="true">✕</span>
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveClass('px-5', 'py-3');
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('py-2');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveClass('size-9', 'p-0');
  });

  it('shows a spinner, aria-busy and a disabled state while loading', () => {
    const { container } = render(<Button loading>Provision New Member</Button>);
    // The accessible name is unchanged: the spinner is decorative, `aria-busy`
    // is what assistive technology reads.
    const button = screen.getByRole('button', { name: 'Provision New Member' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    const spinner = container.querySelector<HTMLElement>('[role="status"].animate-vv-spin');
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(button).toContainElement(spinner);
  });

  it('does not fire onClick while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Provision New Member
      </Button>,
    );
    await user
      .click(screen.getByRole('button', { name: 'Provision New Member' }))
      .catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick when enabled and stays keyboard reachable', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Provision New Member</Button>);
    const button = screen.getByRole('button', { name: 'Provision New Member' });
    button.focus();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports type="submit" for real forms', () => {
    render(<Button type="submit">Send Secure Invitation</Button>);
    expect(screen.getByRole('button', { name: 'Send Secure Invitation' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('renders its child element with asChild', () => {
    render(
      <Button asChild variant="dark">
        <a href="/portal/scans">Open Scan Queue</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Open Scan Queue' });
    expect(link).toHaveAttribute('href', '/portal/scans');
    expect(link).toHaveClass('rounded-full');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('merges a caller className over the variant classes', () => {
    render(<Button className="w-full">Provision New Member</Button>);
    expect(screen.getByRole('button', { name: 'Provision New Member' })).toHaveClass('w-full');
  });

  it('forwards a disabled attribute', () => {
    render(<Button disabled>Provision New Member</Button>);
    expect(screen.getByRole('button', { name: 'Provision New Member' })).toBeDisabled();
  });
});

describe('Spinner', () => {
  it('is a status region with the default accessible name', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner).toHaveClass('animate-vv-spin', 'size-4');
  });

  it('accepts a custom label and size', () => {
    render(<Spinner size="lg" label="Streaming scan output" />);
    expect(screen.getByRole('status', { name: 'Streaming scan output' })).toHaveClass('size-6');
  });
});

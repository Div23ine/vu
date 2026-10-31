// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Badge } from './badge';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe('Badge', () => {
  it('renders the invoice states with their semantic tones', () => {
    render(
      <>
        <Badge tone="settled">Paid</Badge>
        <Badge tone="pending">Pending</Badge>
        <Badge tone="refunded">Refunded</Badge>
      </>,
    );
    expect(screen.getByText('Paid')).toHaveClass('bg-ok-bg', 'text-ok-ink', 'border-ok-line');
    expect(screen.getByText('Pending')).toHaveClass('bg-warn-bg', 'text-warn-ink');
    expect(screen.getByText('Refunded')).toHaveClass('bg-danger-bg', 'text-danger-ink');
  });

  it('renders every severity tone from its own colour token', () => {
    render(
      <>
        <Badge tone="critical">Critical</Badge>
        <Badge tone="high">High</Badge>
        <Badge tone="medium">Medium</Badge>
        <Badge tone="low">Low</Badge>
      </>,
    );
    expect(screen.getByText('Critical')).toHaveClass('text-critical', 'bg-critical/10');
    expect(screen.getByText('High')).toHaveClass('text-high', 'bg-high/10');
    expect(screen.getByText('Medium')).toHaveClass('text-medium', 'bg-medium/10');
    expect(screen.getByText('Low')).toHaveClass('text-low', 'bg-low/10');
  });

  it('renders info and neutral tones', () => {
    render(
      <>
        <Badge tone="info">In Review</Badge>
        <Badge tone="neutral">Draft</Badge>
      </>,
    );
    expect(screen.getByText('In Review')).toHaveClass('bg-brand-tint', 'text-brand-strong');
    expect(screen.getByText('Draft')).toHaveClass('bg-table-head', 'text-ink-muted');
  });

  it('defaults to the neutral tone and shares the pill shape', () => {
    render(<Badge>Paid</Badge>);
    expect(screen.getByText('Paid')).toHaveClass('rounded-full', 'uppercase', 'bg-table-head');
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { ShieldCheck } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { Card, CardBody, CardHead, CardTitle, DarkCard } from './card';
import { EmptyState } from './empty-state';
import { Eyebrow } from './eyebrow';
import { KpiCard, KpiGrid } from './kpi-card';
import { ProgressBar } from './progress-bar';
import { Skeleton } from './skeleton';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe('Card family', () => {
  it('renders the light surface with the card tokens', () => {
    render(
      <Card data-testid="card">
        <CardHead>
          <CardTitle>Active Staff Roster — Security Analysts & Operators</CardTitle>
        </CardHead>
        <CardBody>Body</CardBody>
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('rounded-lg', 'bg-white', 'border-line', 'shadow-card');
    expect(card).toHaveTextContent('Active Staff Roster — Security Analysts & Operators');
    expect(card).toHaveTextContent('Body');
  });

  it('renders the title as an h2 by default and an h3 on request', () => {
    render(
      <>
        <CardTitle>Default Heading</CardTitle>
        <CardTitle as="h3">Nested Heading</CardTitle>
      </>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Default Heading' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Nested Heading' })).toBeInTheDocument();
  });

  it('renders the icon slot before the text and hides it from assistive technology', () => {
    render(
      <CardTitle icon={<ShieldCheck data-testid="title-icon" size={18} />}>
        Active Staff Roster — Security Analysts & Operators
      </CardTitle>,
    );
    const icon = screen.getByTestId('title-icon');
    expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(icon.closest('[aria-hidden="true"]')).toHaveClass('text-brand', 'shrink-0');
    // The icon must not leak into the accessible name of the heading.
    expect(screen.getByRole('heading', { level: 2 })).toHaveAccessibleName(
      'Active Staff Roster — Security Analysts & Operators',
    );
  });

  it('renders the dark surface with white text', () => {
    render(<DarkCard data-testid="dark">Dark panel</DarkCard>);
    const dark = screen.getByTestId('dark');
    expect(dark).toHaveClass('text-white', 'border-brand/26');
    expect(dark).toHaveTextContent('Dark panel');
  });
});

describe('KpiCard', () => {
  it('renders label, value and an upward delta in the ok colour', () => {
    render(
      <KpiCard
        label="Active Team Members"
        value="24"
        delta={{ tone: 'up', text: '▲ 3 onboarded this month' }}
      />,
    );
    expect(screen.getByText('Active Team Members')).toHaveClass(
      'text-ink-faint',
      'uppercase',
      'tracking-[0.14em]',
    );
    expect(screen.getByText('24')).toHaveClass('font-mono', 'text-ink');
    expect(screen.getByText('▲ 3 onboarded this month')).toHaveClass('text-ok');
  });

  it('renders a unit suffix and a warning delta', () => {
    render(
      <KpiCard
        label="MFA Enrolment"
        value="92"
        unit="%"
        delta={{ tone: 'warn', text: '2 accounts without MFA' }}
      />,
    );
    expect(screen.getByText('%')).toHaveClass('text-ink-muted');
    expect(screen.getByText('2 accounts without MFA')).toHaveClass('text-high');
  });

  it('renders a downward delta in the critical colour and hides the accent line', () => {
    const { container } = render(
      <KpiCard
        label="Released Reports"
        value="3"
        delta={{ tone: 'down', text: '▼ 2 vs last week' }}
      />,
    );
    expect(screen.getByText('▼ 2 vs last week')).toHaveClass('text-critical');
    const accent = container.querySelector('.opacity-75');
    expect(accent).not.toBeNull();
    expect(accent).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits the delta line when none is given', () => {
    render(<KpiCard label="Worker Slots" value="12 / 24" />);
    expect(screen.getByText('12 / 24')).toBeInTheDocument();
    expect(screen.queryByText('▲ 3 onboarded this month')).not.toBeInTheDocument();
  });
});

describe('KpiGrid', () => {
  it('is a labelled group that collapses from six columns to two', () => {
    render(
      <KpiGrid aria-label="Security operations at a glance">
        <KpiCard label="Active Team Members" value="24" />
        <KpiCard label="MFA Enrolment" value="92" unit="%" />
      </KpiGrid>,
    );
    const grid = screen.getByRole('group', { name: 'Security operations at a glance' });
    expect(grid).toHaveClass('xl:grid-cols-6', 'md:grid-cols-3', 'grid-cols-2', 'mb-[30px]');
    expect(grid.children).toHaveLength(2);
  });
});

describe('Eyebrow', () => {
  it('renders the kicker copy in brand-strong uppercase', () => {
    render(<Eyebrow>Identity, Access & Provisioning</Eyebrow>);
    const eyebrow = screen.getByText('Identity, Access & Provisioning');
    expect(eyebrow).toHaveClass('text-brand-strong', 'uppercase', 'tracking-[0.2em]');
    expect(eyebrow).toHaveClass('before:w-[22px]', 'before:bg-brand');
  });
});

describe('ProgressBar', () => {
  it('exposes the progressbar semantics with the clamped value', () => {
    render(<ProgressBar value={78} label="JOB-4471 scan progress" />);
    const bar = screen.getByRole('progressbar', { name: 'JOB-4471 scan progress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '78');
    expect(bar.firstElementChild).toHaveStyle({ width: '78%' });
    expect(bar.firstElementChild).toHaveClass('bg-grad-brand');
  });

  it('clamps out-of-range values', () => {
    render(
      <>
        <ProgressBar value={140} label="Over" />
        <ProgressBar value={-20} label="Under" />
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'Over' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByRole('progressbar', { name: 'Under' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technology and shimmers', () => {
    render(<Skeleton data-testid="skeleton" className="h-3 w-32" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton).toHaveClass('rounded-sm', 'bg-line-soft');
    expect(skeleton.className).toContain('after:animate-[vv-shimmer_1.4s_linear_infinite]');
  });
});

describe('EmptyState', () => {
  it('renders the product copy as a status region', () => {
    render(
      <EmptyState
        title="No team members match the current filters"
        description="Adjust your search terms or reset the filters to see the full staff roster."
        action={<Button size="sm">Reset Filters</Button>}
      />,
    );
    const state = screen.getByRole('status');
    expect(state).toHaveTextContent('No team members match the current filters');
    expect(state).toHaveTextContent(
      'Adjust your search terms or reset the filters to see the full staff roster.',
    );
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
  });

  it('renders without a description or an action', () => {
    render(<EmptyState title="No team members match the current filters" />);
    const state = screen.getByRole('status');
    expect(state).toHaveTextContent('No team members match the current filters');
    expect(state).not.toHaveTextContent('Adjust your search terms');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

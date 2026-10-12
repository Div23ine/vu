// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdmKpi, AdminPageHead } from './admin-page-head';

/**
 * Admin page-head + KPI tests (Task 75) — the spec's list: the head renders
 * eyebrow/title/description verbatim and an actions slot; the KPI tile
 * renders a value with a unit and the delta tone classes. The copy is the
 * reference markup's (Command Center head, traffic KPIs).
 */

describe('AdminPageHead', () => {
  it('renders the eyebrow, title and description verbatim plus the actions slot', () => {
    render(
      <AdminPageHead
        eyebrow="Data Analytics Dashboard Overview"
        title="Administrative Command Center"
        description="Consolidated operational intelligence across revenue, network load, job throughput and threat posture. All figures refresh from the VUNVAULT sensor mesh and billing ledger."
        actions={
          <>
            <button type="button" className="adm-btn adm-btn-primary">
              Initiate System Scan
            </button>
            <button type="button" className="adm-btn adm-btn-dark">
              Export Audit Logs
            </button>
            <button type="button" className="adm-btn adm-btn-ghost">
              Refresh Metrics
            </button>
          </>
        }
      />,
    );

    expect(screen.getByText('Data Analytics Dashboard Overview')).toBeInTheDocument();
    const heading = screen.getByRole('heading', {
      name: 'Administrative Command Center',
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('adm-page-title');
    expect(
      screen.getByText(
        'Consolidated operational intelligence across revenue, network load, job throughput and threat posture. All figures refresh from the VUNVAULT sensor mesh and billing ledger.',
      ),
    ).toBeInTheDocument();

    // The actions slot is right-aligned chrome holding whatever the page passes.
    for (const name of ['Initiate System Scan', 'Export Audit Logs', 'Refresh Metrics']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    const actions = screen.getByRole('button', { name: 'Refresh Metrics' }).parentElement;
    expect(actions).toHaveClass('adm-head-actions');
    expect(document.querySelector('.adm-page-head')).not.toBeNull();
  });

  it('renders no actions wrapper without actions', () => {
    const { container } = render(<AdminPageHead eyebrow="E" title="T" description="D" />);
    expect(container.querySelector('.adm-head-actions')).toBeNull();
  });
});

describe('AdmKpi', () => {
  it('renders label, monospace value with unit and the up-delta tone class', () => {
    render(
      <AdmKpi
        label="Avg. Response"
        value="142"
        unit="ms"
        delta={{ tone: 'up', text: '▲ 6.2% day over day' }}
      />,
    );
    expect(screen.getByText('Avg. Response')).toHaveClass('adm-kpi-label');
    const value = screen.getByText('142');
    expect(value).toHaveClass('adm-kpi-value');
    expect(value.querySelector('small')).toHaveTextContent('ms');
    const delta = screen.getByText('▲ 6.2% day over day');
    expect(delta).toHaveClass('adm-kpi-delta');
    expect(delta).toHaveClass('adm-kpi-delta--up');
    expect(screen.getByText('Avg. Response').closest('article')).toHaveClass('adm-kpi');
  });

  it.each([
    ['down', 'adm-kpi-delta--down'],
    ['warn', 'adm-kpi-delta--warn'],
  ] as const)('applies the %s tone modifier', (tone, expected) => {
    render(<AdmKpi label="L" value="1" delta={{ tone, text: 'trend line' }} />);
    expect(screen.getByText('trend line')).toHaveClass(expected);
  });

  it('the dot tone stays neutral (no modifier) and the delta is optional', () => {
    const { rerender } = render(
      <AdmKpi
        label="Pending Review"
        value="37"
        delta={{ tone: 'dot', text: '● Awaiting mandatory admin review' }}
      />,
    );
    const delta = screen.getByText('● Awaiting mandatory admin review');
    expect(delta).toHaveClass('adm-kpi-delta');
    expect(delta.className).not.toContain('adm-kpi-delta--');

    rerender(<AdmKpi label="Total Paid Clients" value="312" />);
    expect(screen.queryByText('● Awaiting mandatory admin review')).not.toBeInTheDocument();
    expect(document.querySelector('.adm-kpi-delta')).toBeNull();
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef, RowSelectionState, SortingState } from '@tanstack/react-table';
import { Badge } from './badge';
import { Button } from './button';
import { DataTable } from './data-table';
import { Pagination, ResultCount } from './table-footer';
import { selectColumn } from './select-column';
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CAPTION =
  'Active staff roster of security analysts and operators with role, scope, MFA status and account state';

interface MemberRow {
  id: string;
  member: string;
  scope: string;
  mfa: string;
  lastActive: string;
  status: 'active' | 'suspended';
}

const ROWS: MemberRow[] = [
  {
    id: 'u-reed',
    member: 'Dr. Evelyn Reed',
    scope: 'Full platform · All modules',
    mfa: 'WebAuthn',
    lastActive: 'Now · 12:00',
    status: 'active',
  },
  {
    id: 'u-njoroge',
    member: 'Amara Njoroge',
    scope: 'Offensive Security · Pentest queue',
    mfa: 'TOTP',
    lastActive: '12 min ago',
    status: 'active',
  },
  {
    id: 'u-ndegwa',
    member: 'Peter Ndegwa',
    scope: 'Client Support · Ticketing only',
    mfa: 'Tokens revoked',
    lastActive: '12 Sep 08:10',
    status: 'suspended',
  },
];

function memberColumns(): ColumnDef<MemberRow, unknown>[] {
  return [
    { accessorKey: 'member', header: 'Member', enableSorting: true },
    { accessorKey: 'scope', header: 'Scope & Team', enableSorting: false },
    { accessorKey: 'mfa', header: 'MFA / Access', enableSorting: false },
    { accessorKey: 'lastActive', header: 'Last Active', enableSorting: true },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge tone={row.original.status === 'active' ? 'ok' : 'danger'}>
          {row.original.status === 'active' ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: () => (
        <Button size="icon" variant="ghost" aria-label="Open member record">
          ⋯
        </Button>
      ),
    },
  ];
}

const EMPTY = {
  title: 'No team members match the current filters',
  description: 'Adjust your search terms or reset the filters to see the full staff roster.',
  action: <Button size="sm">Reset Filters</Button>,
};

/** jsdom lacks the resize/scroll/pointer APIs Radix controls rely on. */
beforeAll(() => {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe('DataTable', () => {
  it('describes itself to assistive technology through a hidden caption', () => {
    render(<DataTable caption={CAPTION} columns={memberColumns()} data={ROWS} empty={EMPTY} />);
    const table = screen.getByRole('table', { name: CAPTION });
    const caption = table.querySelector('caption');
    expect(caption).not.toBeNull();
    expect(caption).toHaveClass('sr-only');
    expect(caption).toHaveTextContent(CAPTION);
  });

  it('renders the product column headers in order', () => {
    render(<DataTable caption={CAPTION} columns={memberColumns()} data={ROWS} empty={EMPTY} />);
    const headers = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim() ?? '');
    expect(headers).toEqual([
      'Member',
      'Scope & Team',
      'MFA / Access',
      'Last Active',
      'Status',
      'Actions',
    ]);
  });

  it('renders a row per record with cell components', () => {
    render(<DataTable caption={CAPTION} columns={memberColumns()} data={ROWS} empty={EMPTY} />);
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(screen.getByText('Dr. Evelyn Reed')).toBeInTheDocument();
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges).toHaveLength(2);
    for (const badge of activeBadges) expect(badge).toHaveClass('text-ok-ink');
    expect(screen.getByText('Suspended')).toHaveClass('text-danger-ink');
    expect(screen.getAllByRole('button', { name: 'Open member record' })).toHaveLength(3);
  });

  it('sorts through the header button and exposes aria-sort', async () => {
    const user = userEvent.setup();
    const onSortingChange = vi.fn();
    render(
      <DataTable
        caption={CAPTION}
        columns={memberColumns()}
        data={ROWS}
        empty={EMPTY}
        sorting={[]}
        onSortingChange={onSortingChange}
      />,
    );

    const memberHeader = screen.getByRole('columnheader', { name: /Member/ });
    expect(memberHeader).toHaveAttribute('aria-sort', 'none');
    // Unsortable columns carry no aria-sort at all.
    expect(screen.getByRole('columnheader', { name: /Scope & Team/ })).not.toHaveAttribute(
      'aria-sort',
    );

    await user.click(within(memberHeader).getByRole('button', { name: /Member/ }));
    expect(onSortingChange).toHaveBeenCalled();
  });

  it('reflects a controlled descending sort', () => {
    const sorting: SortingState = [{ id: 'member', desc: true }];
    render(
      <DataTable
        caption={CAPTION}
        columns={memberColumns()}
        data={ROWS}
        empty={EMPTY}
        sorting={sorting}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Member/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('renders six skeleton rows while loading', () => {
    const { container } = render(
      <DataTable caption={CAPTION} columns={memberColumns()} data={[]} isLoading empty={EMPTY} />,
    );
    const body = container.querySelector('tbody');
    expect(body).not.toBeNull();
    expect(within(body as HTMLElement).getAllByRole('row')).toHaveLength(6);
    // One placeholder per column per row, all hidden from assistive technology.
    expect((body as HTMLElement).querySelectorAll('[aria-hidden="true"]')).toHaveLength(
      6 * memberColumns().length,
    );
    expect(screen.queryByText('No team members match the current filters')).not.toBeInTheDocument();
  });

  it('renders the empty state inside the table when there is no data', () => {
    render(<DataTable caption={CAPTION} columns={memberColumns()} data={[]} empty={EMPTY} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('No team members match the current filters');
    expect(status).toHaveTextContent(
      'Adjust your search terms or reset the filters to see the full staff roster.',
    );
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
    // The empty row spans every column.
    expect(status.closest('td')).toHaveAttribute('colspan', String(memberColumns().length));
  });

  it('selects rows and reports the selection', async () => {
    const user = userEvent.setup();
    const onRowSelectionChange = vi.fn();
    const columns = [selectColumn<MemberRow>(), ...memberColumns()];
    render(
      <DataTable
        caption={CAPTION}
        columns={columns}
        data={ROWS}
        empty={EMPTY}
        getRowId={(row) => row.id}
        enableRowSelection
        rowSelection={{}}
        onRowSelectionChange={onRowSelectionChange}
      />,
    );

    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    const rowCheckboxes = screen.getAllByRole('checkbox', { name: 'Select row' });
    expect(rowCheckboxes).toHaveLength(ROWS.length);

    await user.click(rowCheckboxes[0] as HTMLElement);
    expect(onRowSelectionChange).toHaveBeenCalled();

    await user.click(selectAll);
    expect(onRowSelectionChange).toHaveBeenCalledTimes(2);
  });

  it('shows an indeterminate header checkbox while some rows are selected', () => {
    const columns = [selectColumn<MemberRow>(), ...memberColumns()];
    const selection: RowSelectionState = { 'u-reed': true };
    render(
      <DataTable
        caption={CAPTION}
        columns={columns}
        data={ROWS}
        empty={EMPTY}
        getRowId={(row) => row.id}
        enableRowSelection
        rowSelection={selection}
      />,
    );
    const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
    expect(selectAll).toHaveAttribute('data-state', 'indeterminate');
    expect(selectAll).toHaveAttribute('aria-checked', 'mixed');
    // The selected row carries the brand inset marker.
    expect(screen.getByText('Dr. Evelyn Reed').closest('tr')).toHaveAttribute(
      'data-state',
      'selected',
    );
  });

  it('fires the row click for the row but not for controls inside it', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption={CAPTION}
        columns={memberColumns()}
        data={ROWS}
        empty={EMPTY}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByText('Amara Njoroge'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);

    await user.click(
      screen.getAllByRole('button', { name: 'Open member record' })[0] as HTMLElement,
    );
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('activates a row from the keyboard without a row role', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption={CAPTION}
        columns={memberColumns()}
        data={ROWS}
        empty={EMPTY}
        onRowClick={onRowClick}
      />,
    );

    const row = screen.getByText('Dr. Evelyn Reed').closest('tr') as HTMLTableRowElement;
    expect(row.tagName).toBe('TR');
    expect(row).not.toHaveAttribute('role');
    expect(row).toHaveAttribute('tabindex', '0');
    expect(row).toHaveClass('cursor-pointer');

    row.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
    await user.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('leaves rows inert when no row click handler is given', () => {
    render(<DataTable caption={CAPTION} columns={memberColumns()} data={ROWS} empty={EMPTY} />);
    const row = screen.getByText('Dr. Evelyn Reed').closest('tr');
    expect(row).not.toHaveAttribute('tabindex');
    expect(row).not.toHaveClass('cursor-pointer');
  });
});

describe('ResultCount', () => {
  it('renders the product readout', () => {
    render(<ResultCount shown={10} total={24} noun="members" />);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 10 of 24 members');
    expect(screen.getByText('10')).toHaveClass('font-mono');
    expect(screen.getByText('24')).toHaveClass('font-mono');
  });
});

describe('Pagination', () => {
  it('renders the position readout and enables both controls mid-range', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={5} onPageChange={onPageChange} />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText('Page 2 of 5')).toHaveClass('font-mono');

    await user.click(within(nav).getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    await user.click(within(nav).getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous on the first page and next on the last', () => {
    render(<Pagination page={1} pageCount={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();

    render(<Pagination page={5} pageCount={5} onPageChange={vi.fn()} />);
    const nextButtons = screen.getAllByRole('button', { name: 'Next page' });
    expect(nextButtons[nextButtons.length - 1]).toBeDisabled();
  });
});

describe('selectColumn', () => {
  it('is a non-sortable, non-hideable checkbox column', () => {
    const column = selectColumn<MemberRow>();
    expect(column.id).toBe('select');
    expect(column.enableSorting).toBe(false);
    expect(column.enableHiding).toBe(false);
  });

  it('stops propagation from its own checkbox', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption={CAPTION}
        columns={[selectColumn<MemberRow>(), ...memberColumns()]}
        data={ROWS}
        empty={EMPTY}
        getRowId={(row) => row.id}
        enableRowSelection
        onRowClick={onRowClick}
      />,
    );
    await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0] as HTMLElement);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

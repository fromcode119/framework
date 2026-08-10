import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from '@/components/ui/view/data-table.client';

/**
 * A wide list pushes the row's actions off the right edge, and the row cannot be acted on at all
 * without scrolling back. So the actions column is pinned by default, and the operator can pin any
 * column they need to keep in view.
 *
 * These assert the CONTRACT the browser then applies: which cells are `sticky`, which edge they are
 * pinned to, and the order the columns render in. jsdom performs no layout, so every measured width is
 * 0 here — the offset ARITHMETIC is covered in sticky-column-layout.test.ts, against real widths.
 */
vi.mock('@fromcode119/react', async () => {
  const React = await import('react');
  const MockIcon = () => <div data-testid="mock-icon" />;
  return {
    FrameworkIcons: new Proxy({}, { get: () => MockIcon }),
    PluginComponent: class extends React.Component<any> {},
    ContextHooks: { usePlugins: vi.fn(() => ({})) },
    Slot: ({ children }: any) => <div>{children}</div>,
  };
});

const COLUMNS = [
  { id: 'orderNumber', header: 'Order', accessor: 'orderNumber' },
  { id: 'customer', header: 'Customer', accessor: 'customer' },
  { id: 'total', header: 'Total', accessor: 'total' },
];

const ROWS = [
  { id: '1', orderNumber: '#567', customer: 'Ada', total: '36.00' },
  { id: '2', orderNumber: '#568', customer: 'Grace', total: '12.00' },
];

function renderTable(props: Record<string, any> = {}) {
  return render(
    <DataTable columns={COLUMNS as any} data={ROWS as any} {...props} />,
  );
}

const headers = (): string[] =>
  Array.from(document.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim());

const isSticky = (cell: Element | null): boolean => (cell?.className || '').includes('sticky');

describe('DataTable — pinned columns', () => {
  it('renders every column unpinned when nothing is pinned', () => {
    renderTable();
    expect(headers()).toEqual(['Order', 'Customer', 'Total']);
    expect(Array.from(document.querySelectorAll('thead th')).some(isSticky)).toBe(false);
  });

  it('moves a pinned column to the left edge instead of pinning it mid-table', () => {
    renderTable({ stickyColumnIds: ['total'] });
    expect(headers()).toEqual(['Total', 'Order', 'Customer']);
  });

  it('marks the pinned header cell sticky and leaves the rest alone', () => {
    renderTable({ stickyColumnIds: ['total'] });
    const cells = Array.from(document.querySelectorAll('thead th'));
    expect(isSticky(cells[0])).toBe(true);
    expect(cells.slice(1).some(isSticky)).toBe(false);
  });

  it('pins the matching BODY cell too — a pinned header over scrolling data is the bug', () => {
    renderTable({ stickyColumnIds: ['total'] });
    const firstBodyRowCells = Array.from(document.querySelectorAll('tbody tr')[0].querySelectorAll('td'));
    expect(isSticky(firstBodyRowCells[0])).toBe(true);
    expect(firstBodyRowCells[0].textContent).toContain('36.00');
  });

  it('pins several columns as one run, in the order they were pinned', () => {
    renderTable({ stickyColumnIds: ['total', 'orderNumber'] });
    expect(headers()).toEqual(['Total', 'Order', 'Customer']);
    const cells = Array.from(document.querySelectorAll('thead th'));
    expect([isSticky(cells[0]), isSticky(cells[1]), isSticky(cells[2])]).toEqual([true, true, false]);
  });

  it('pins the selection checkbox too, so the pinned run starts at the real edge', () => {
    renderTable({ stickyColumnIds: ['total'], selectable: true, selectedIds: [], onSelectionChange: vi.fn() });
    const cells = Array.from(document.querySelectorAll('thead th'));
    expect(isSticky(cells[0])).toBe(true); // checkbox
    expect(isSticky(cells[1])).toBe(true); // pinned column
  });

  it('leaves the checkbox unpinned when no column is pinned', () => {
    renderTable({ selectable: true, selectedIds: [], onSelectionChange: vi.fn() });
    expect(isSticky(document.querySelectorAll('thead th')[0])).toBe(false);
  });

  it('ignores a pin naming a column that is not shown', () => {
    renderTable({ stickyColumnIds: ['deletedColumn'] });
    expect(headers()).toEqual(['Order', 'Customer', 'Total']);
    expect(Array.from(document.querySelectorAll('thead th')).some(isSticky)).toBe(false);
  });
});

describe('DataTable — pinned actions', () => {
  const actions = () => <button type="button">Edit</button>;

  it('pins the actions column to the RIGHT edge by default', () => {
    renderTable({ actions });
    const cells = Array.from(document.querySelectorAll('thead th'));
    const actionsHeader = cells[cells.length - 1];
    expect(actionsHeader.textContent).toContain('Actions');
    expect(actionsHeader.className).toContain('sticky');
    expect(actionsHeader.className).toContain('right-0');
  });

  it('pins the actions cell on every row, not just the header', () => {
    renderTable({ actions });
    for (const row of Array.from(document.querySelectorAll('tbody tr'))) {
      const cells = row.querySelectorAll('td');
      expect(cells[cells.length - 1].className).toContain('sticky');
    }
    expect(screen.getAllByText('Edit')).toHaveLength(ROWS.length);
  });

  it('can be opted out of', () => {
    renderTable({ actions, stickyActions: false });
    const cells = Array.from(document.querySelectorAll('thead th'));
    expect(cells[cells.length - 1].className).not.toContain('sticky');
  });

  it('pins both edges at once — left run and right actions are independent', () => {
    renderTable({ actions, stickyColumnIds: ['total'] });
    const cells = Array.from(document.querySelectorAll('thead th'));
    expect(cells[0].className).toContain('sticky');
    expect(cells[cells.length - 1].className).toContain('right-0');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from '@/components/ui/view/data-table.client';

/**
 * Every plugin screen built on DataTable gets the collection lists' narrow layout: below 960px of the
 * table's own width (a container query in admin.css) each row is a card. jsdom applies no CSS, so these
 * assert the markup the stylesheet switches between.
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
  { id: 'name', header: 'Name', accessor: 'name' },
  { id: 'birthDate', header: 'Birth date', accessor: 'birthDate' },
  { id: 'email', header: 'Email', accessor: (row: any) => row.email ?? '—' },
];

const ROWS = [
  { id: '1', name: 'Нели Гайдарова', birthDate: '1989-05-26', email: 'neli@example.com' },
  { id: '2', name: 'Петя Славова', birthDate: '1975-12-14', email: null },
];

const cards = (): HTMLElement => document.querySelector('.fc-data-table-cards') as HTMLElement;

describe('DataTable — cards below desktop width', () => {
  it('renders the rows both ways inside a width container, by default', () => {
    render(<DataTable columns={COLUMNS as any} data={ROWS as any} />);
    expect(document.querySelector('.fc-data-table')).not.toBeNull();
    expect(document.querySelector('.fc-data-table-rows table')).not.toBeNull();
    expect(cards().textContent).toContain('Нели Гайдарова');
  });

  it('titles a card with the first column and labels the others with their heading', () => {
    render(<DataTable columns={COLUMNS as any} data={ROWS as any} />);
    const first = cards().children[0]!.children[0] as HTMLElement;
    expect(first.textContent).toContain('Birth date1989-05-26');
    expect(first.textContent).toContain('Emailneli@example.com');
  });

  it('leaves an empty value off the card rather than printing its heading alone', () => {
    render(<DataTable columns={COLUMNS as any} data={ROWS as any} />);
    const second = cards().children[0]!.children[1] as HTMLElement;
    expect(second.textContent).not.toContain('Email');
  });

  it('opens the row from the card, but not from its actions', () => {
    const onRowClick = vi.fn();
    const onEdit = vi.fn();
    render(<DataTable columns={COLUMNS as any} data={ROWS as any} onRowClick={onRowClick}
      actions={(row: any) => <button onClick={() => onEdit(row.id)}>Edit {row.id}</button>} />);
    fireEvent.click(cards().querySelector('.text-\\[14px\\]')!);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
    const editButtons = screen.getAllByText('Edit 2');
    fireEvent.click(editButtons[0]!);
    expect(onEdit).toHaveBeenCalledWith('2');
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('can be opted out of — the collection list draws its own cards', () => {
    render(<DataTable columns={COLUMNS as any} data={ROWS as any} cards={false} />);
    expect(document.querySelector('.fc-data-table-cards')).toBeNull();
    expect(document.querySelector('.fc-data-table')).toBeNull();
  });
});

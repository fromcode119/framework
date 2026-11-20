import { render, screen } from '@testing-library/react';
import { ArrayField } from '@/components/ui/view/array-field.client';

/**
 * Rows of declared sub-fields, asked for as a table: the names belong in a header, once, not repeated
 * inside a bordered card per row. A plugin that wanted this had no way to ask for it and drew its own
 * control instead — three times over, for videos, specifications and prices-per-currency.
 */
const videos = {
  name: 'videos',
  label: 'Videos',
  type: 'json',
  admin: { layout: 'table' },
  fields: [
    { name: 'url', label: 'Link', type: 'text' },
    { name: 'title', label: 'Title', type: 'text' },
  ],
};

describe('a row list drawn as a table', () => {
  it('names each column once, in a header', () => {
    render(<ArrayField field={videos} value={[{ url: 'https://a', title: 'One' }, { url: 'https://b', title: 'Two' }]} onChange={() => {}} collectionSlug="products" />);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Link', 'Title', 'Actions']);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('shows no empty table before the first row, only the way to add one', () => {
    render(<ArrayField field={videos} value={[]} onChange={() => {}} collectionSlug="products" />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: /^Add$/i })).toBeTruthy();
  });

  it('keeps the stacked layout when the field does not ask for a table', () => {
    render(<ArrayField field={{ ...videos, admin: {} }} value={[{ url: 'https://a', title: 'One' }]} onChange={() => {}} collectionSlug="products" />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByText('Link')).toHaveLength(1);
  });
});

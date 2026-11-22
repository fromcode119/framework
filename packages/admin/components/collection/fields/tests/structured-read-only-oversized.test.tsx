import { fireEvent, render, screen } from '@testing-library/react';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';

/**
 * A stored object too big for a card is told as ONE row that opens a drawer. An order's record printed
 * 166 values and its "order data" 24 more, 3 400px of keys beside a 500px order; a product's storefront
 * snapshot printed 284 and made the product page 19 695px tall. Whatever the object, the card shows the
 * row, and every value is in the drawer, searchable.
 */
const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, `value ${i}`]));

describe('StructuredReadOnlyField, a value too big for a card', () => {
  it('is one row with its count, and prints none of its values in the card', () => {
    render(<StructuredReadOnlyField value={{ own: 'shown', deep: many(120) }} field={{ name: 'snapshot', label: 'Snapshot' }} />);
    expect(screen.getByRole('button', { name: 'Snapshot' })).toBeInTheDocument();
    expect(screen.getByText(/121/)).toBeInTheDocument();
    expect(screen.queryByText('shown')).toBeNull();
    expect(screen.queryByText('value 7')).toBeNull();
  });

  it('opens every value in a drawer', () => {
    render(<StructuredReadOnlyField value={{ own: 'shown', deep: many(120) }} field={{ name: 'snapshot', label: 'Snapshot' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Snapshot' }));
    expect(screen.getByText('shown')).toBeInTheDocument();
    expect(screen.getByText('value 7')).toBeInTheDocument();
  });

  it('puts the keys its owner did not name under Technical, with their number', () => {
    render(<StructuredReadOnlyField value={{ ...many(13), email: 'a@b.c' }} field={{ name: 'record', label: 'Record', admin: { keyLabels: { email: 'Email address' } } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Technical/i })).toBeInTheDocument();
  });

  it('keeps a value small enough to read in full where it stands', () => {
    render(<StructuredReadOnlyField value={{ own: 'shown', deep: many(3) }} field={{ name: 'snapshot' }} />);
    expect(screen.getByText('value 1')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

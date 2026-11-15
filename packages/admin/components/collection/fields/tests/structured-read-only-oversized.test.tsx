import { render, screen } from '@testing-library/react';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';

/**
 * Past a few dozen values a recorded field stops being read and starts being searched. One product's
 * storefront snapshot printed 284 of them and made that record 19 695px tall. The field now draws its
 * own values, names what is under them with a count, and says how many it did not print — the filter
 * above reaches every one, so nothing is dropped and nothing is behind a disclosure.
 */
const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`key${i}`, `value ${i}`]));

describe('StructuredReadOnlyField, an oversized value', () => {
  it('names the groups with their counts and says what it did not print', () => {
    render(<StructuredReadOnlyField value={{ own: 'shown', deep: many(120) }} field={{ name: 'snapshot' }} />);
    // This level's own value is printed.
    expect(screen.getByText('shown')).toBeInTheDocument();
    // What is under it is named and counted, not printed.
    expect(screen.getByRole('heading', { name: /Deep/i })).toBeInTheDocument();
    expect(screen.queryByText('value 7')).toBeNull();
    // The count badge beside the group's name, and the line saying what was not printed.
    expect(screen.getAllByText(/120/).length).toBeGreaterThanOrEqual(2);
  });

  it('prints a value small enough to read in full', () => {
    render(<StructuredReadOnlyField value={{ own: 'shown', deep: many(3) }} field={{ name: 'snapshot' }} />);
    expect(screen.getByText('value 1')).toBeInTheDocument();
  });
});

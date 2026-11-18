import { describe, it, expect } from 'vitest';
import { RecordSectionChips } from '@/components/collection/edit/record-section-chips';

/**
 * A record card used to draw any short array as chips before it asked what the field IS. A
 * relationship's value is a list of ids, so a product's categories read "5 55 75" on the record
 * page while the list beside it printed the same three by name.
 */
describe('What a record card may draw as chips', () => {
  it('still makes chips of a handful of short written values', () => {
    expect(RecordSectionChips.of(['red', 'green'])).toEqual(['red', 'green']);
  });

  it('makes chips of ids too, which is why the card must not offer a relationship to it', () => {
    expect(RecordSectionChips.of([5, 55, 75])).toEqual(['5', '55', '75']);
  });

  it('declines anything that is not a handful of short scalars', () => {
    expect(RecordSectionChips.of([{ id: 5 }])).toBeNull();
    expect(RecordSectionChips.of([])).toBeNull();
    expect(RecordSectionChips.of(Array.from({ length: 13 }, (_, i) => i + 1))).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { CollectionEditStartingValues } from '@/components/collection/edit/view/collection-edit-starting-values.client';

/**
 * A link that opens a new record may carry what the linking page already knows (`with.<field>`), so a
 * return opens with its shipment chosen. Only declared fields are taken.
 */
const collection = { fields: [{ name: 'order', type: 'relationship' }, { name: 'reason', type: 'text' }, { name: 'amount', type: 'number' }] };

describe('CollectionEditStartingValues', () => {
  it('takes declared fields, as the form would hold them', () => {
    const given = CollectionEditStartingValues.read(collection, new URLSearchParams('with.order=7&with.reason=damaged&with.amount=4.5'));
    expect(given).toEqual({ order: 7, reason: 'damaged', amount: 4.5 });
  });

  it('ignores a field the collection does not declare, an empty value and any other parameter', () => {
    const given = CollectionEditStartingValues.read(collection, new URLSearchParams('with.secret=1&with.reason=&order=9&duplicateFrom=3'));
    expect(given).toEqual({});
  });

  it('keeps a non-numeric relationship value as text', () => {
    expect(CollectionEditStartingValues.read(collection, new URLSearchParams('with.order=abc'))).toEqual({ order: 'abc' });
  });
});

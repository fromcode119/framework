import { describe, it, expect } from 'vitest';
import { CollectionRecordLinksDeclaration } from '@/components/collection/edit/collection-record-links-declaration';

/**
 * A collection says which of its sections each part of a record belongs in. The sections draw those
 * parts; the linked-records list keeps only what has no section on screen.
 */
const collection = {
  admin: {
    recordLinks: {
      kind: 'demo:thing',
      keys: { reference: 'reference', thingId: 'id' },
      parts: { payment: { section: 'Totals', empty: 'Nothing paid yet.' }, delivery: { section: 'Delivery', menu: true }, schedule: { section: 'Delivery' } },
    },
  },
};

describe('CollectionRecordLinksDeclaration', () => {
  it('asks nothing when the collection declares no links or the record can offer no key', () => {
    expect(CollectionRecordLinksDeclaration.of({ admin: {} }, { reference: 'A1' }, '3')).toBeNull();
    expect(CollectionRecordLinksDeclaration.of(collection, { reference: ' ' }, '3')).toBeNull();
  });

  it('sends only the keys this record has a value for', () => {
    const links = CollectionRecordLinksDeclaration.of(collection, { reference: 'A1', id: '' }, '3')!;
    expect(links.keys).toEqual({ reference: 'A1' });
  });

  it('hands a section the parts mapped to it, with the words for an empty part', () => {
    const links = CollectionRecordLinksDeclaration.of(collection, { reference: 'A1' }, '3')!;
    expect(links.partsOf('Totals')).toEqual([{ term: 'payment', empty: 'Nothing paid yet.', menu: false }]);
    expect(links.partsOf('Delivery').map((part) => part.term)).toEqual(['delivery', 'schedule']);
    expect(links.partsOf('Notes')).toEqual([]);
  });

  it('keeps a part the collection lists in the section menu out of the section body', () => {
    const links = CollectionRecordLinksDeclaration.of(collection, { reference: 'A1' }, '3')!;
    expect(links.partsOf('Delivery').map((part) => [part.term, part.menu])).toEqual([['delivery', true], ['schedule', false]]);
  });

  it('counts a part as placed only while its section is on screen', () => {
    const links = CollectionRecordLinksDeclaration.of(collection, { reference: 'A1' }, '3')!;
    expect(links.placedTerms(['Totals'])).toEqual(['payment']);
    expect(links.placedTerms([])).toEqual([]);
  });
});

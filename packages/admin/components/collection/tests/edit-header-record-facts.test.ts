import { describe, it, expect } from 'vitest';
import { EditHeaderRecordFacts } from '@/components/collection/edit/view/edit-header-record-facts.client';

/** The line under a record's title names where it stands, using the fields its list already shows. */
describe('EditHeaderRecordFacts', () => {
  const collection = {
    admin: { list: { meta: ['receiverName', 'paymentState', 'missing'] } },
    fields: [
      { name: 'receiverName', type: 'text' },
      { name: 'paymentState', type: 'select', options: [{ label: 'Paid', value: 'paid' }] },
    ],
  };

  it('reads each list fact as a person reads it: the option label, not the stored code', () => {
    expect(EditHeaderRecordFacts.of(collection, { receiverName: 'Ana Buyer', paymentState: 'paid' })).toEqual(['Ana Buyer', 'Paid']);
  });

  it('leaves out a fact with no value and a name no field declares', () => {
    expect(EditHeaderRecordFacts.of(collection, { receiverName: '', paymentState: 'paid' })).toEqual(['Paid']);
  });

  it('is empty for a collection that declares no list facts', () => {
    expect(EditHeaderRecordFacts.of({ fields: [] }, { a: 1 })).toEqual([]);
  });
});

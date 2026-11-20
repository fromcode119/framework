import { describe, expect, it } from 'vitest';
import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';

const options = [
  { label: 'Pending', value: 'pending', reachableFrom: [] },
  { label: 'Processing', value: 'processing', reachableFrom: ['pending'] },
  { label: 'Completed', value: 'completed', reachableFrom: ['processing'] },
  { label: 'Cancelled', value: 'cancelled', reachableFrom: ['pending', 'processing'] },
];
const values = (stored: unknown) => CollectionEditDerivations.reachableStatusOptions(options, stored).map((o) => o.value);

describe('the record header offers only the statuses reachable from the stored one', () => {
  it('lists the current status and the moves its options allow', () => {
    expect(values('pending')).toEqual(['pending', 'processing', 'cancelled']);
    expect(values('processing')).toEqual(['processing', 'completed', 'cancelled']);
  });

  it('carries what a status says it does, so the header can ask before saving it', () => {
    const asked = CollectionEditDerivations.reachableStatusOptions(
      [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed', confirm: 'The buyer is emailed.' }], 'open');
    expect(asked.map((o) => o.confirm)).toEqual([undefined, 'The buyer is emailed.']);
  });

  it('offers nothing on a record that can no longer move', () => {
    expect(values('cancelled')).toEqual([]);
  });

  it('offers every option for a new record and for options that declare no restriction', () => {
    expect(values('')).toEqual(['pending', 'processing', 'completed', 'cancelled']);
    expect(CollectionEditDerivations.reachableStatusOptions([{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], 'a').map((o) => o.value)).toEqual(['a', 'b']);
  });
});

describe('the form select offers only the values reachable from the stored one', () => {
  const field = (stored: unknown) => CollectionEditDerivations.reachableFieldOptions(options, stored).map((o) => o.value);

  it('keeps the held value even when nothing else is reachable', () => {
    expect(field('cancelled')).toEqual(['cancelled']);
    expect(field('pending')).toEqual(['pending', 'processing', 'cancelled']);
  });

  it('leaves a record with no value yet as declared', () => {
    expect(field('')).toEqual(['pending', 'processing', 'completed', 'cancelled']);
  });
});

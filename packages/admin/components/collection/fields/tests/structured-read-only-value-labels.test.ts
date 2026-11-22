import { describe, expect, it } from 'vitest';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

describe('StructuredReadOnlyFieldService.relabelValues', () => {
  const labels = { pending: 'Чакаща' };

  it('words a stored value at any depth and leaves keys, numbers and other text alone', () => {
    const out = StructuredReadOnlyFieldService.relabelValues(
      [{ status: 'pending', pending: 'x', note: 'pending review', count: 2, nested: { status: 'pending' } }],
      labels,
    );
    expect(out).toEqual([{ status: 'Чакаща', pending: 'x', note: 'pending review', count: 2, nested: { status: 'Чакаща' } }]);
  });

  it('returns the value as it is when the owner named no values', () => {
    const value = { status: 'pending' };
    expect(StructuredReadOnlyFieldService.relabelValues(value, undefined)).toBe(value);
    expect(StructuredReadOnlyFieldService.relabelValues(value, {})).toBe(value);
  });
});

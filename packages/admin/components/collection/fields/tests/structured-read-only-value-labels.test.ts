import { describe, expect, it } from 'vitest';
import { StructuredReadOnlySummaryService } from '@/components/collection/fields/structured-read-only-summary-service';

describe('StructuredReadOnlySummaryService.relabelValues', () => {
  const labels = { pending: 'Чакаща' };

  it('words a stored value at any depth and leaves keys, numbers and other text alone', () => {
    const out = StructuredReadOnlySummaryService.relabelValues(
      [{ status: 'pending', pending: 'x', note: 'pending review', count: 2, nested: { status: 'pending' } }],
      labels,
    );
    expect(out).toEqual([{ status: 'Чакаща', pending: 'x', note: 'pending review', count: 2, nested: { status: 'Чакаща' } }]);
  });

  it('returns the value as it is when the owner named no values', () => {
    const value = { status: 'pending' };
    expect(StructuredReadOnlySummaryService.relabelValues(value, undefined)).toBe(value);
    expect(StructuredReadOnlySummaryService.relabelValues(value, {})).toBe(value);
  });
});

import { describe, it, expect } from 'vitest';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { ReadOnlyFieldValue } from '@/components/collection/view/read-only-field-value.client';

describe('a related record is never printed as an object', () => {
  const course = { type: 'relationship', name: 'course' };

  it('names a populated record by its own title', () => {
    expect(ReadOnlyFieldValue.describe(course, { id: 4, title: 'Intro' })).toBe('Intro');
  });

  it('leaves a bare id out of a heading line', () => {
    expect(ReadOnlyFieldValue.describe(course, 4)).toBe('');
  });

  it('skips a part that is itself an object', () => {
    expect(ReadOnlyFieldValue.describe(course, { id: { nested: true } })).toBe('');
    expect(CollectionListUtils.resolveRelationScalar({ id: { nested: true }, slug: 'intro' })).toBe('intro');
    expect(CollectionListUtils.resolveRelationDisplayLabel({ title: {}, id: 7 })).toBe('7');
  });

  it('shows a cell with nothing readable as a dash, not as developer text', () => {
    expect(CollectionListUtils.formatCellValue({ part: { a: 1 } })).toBe('-');
    expect(CollectionListUtils.formatCellValue([{ part: { a: 1 } }])).toBe('-');
  });
});

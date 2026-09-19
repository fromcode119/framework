import { describe, expect, it } from 'vitest';
import { TenantColumnFold } from '@core/tenant/provisioning/tenant-column-fold';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * An older schema kept one value as several flat columns; the current one keeps it as a single JSON
 * field. The destination has no such columns, so without a fold every one of them is discarded —
 * the data is not unwanted, it is unmapped. The claim comes from the collection, never from a guess
 * about a column's name, so these fixtures use invented column and key names.
 */
describe('TenantTableDescriptor folds', () => {
  const fold = new TenantColumnFold('alpha_box', {
    alpha_box_one: 'one',
    alpha_box_two: 'two',
  });
  const descriptor = new TenantTableDescriptor(
    'example_table',
    { id: 'integer', alpha_box: 'jsonb' },
    true,
    'example_table_id_seq',
    [],
    new Set(),
    null,
    null,
    [fold],
  );

  it('claims exactly the columns the declaration names', () => {
    expect(descriptor.foldsColumn('alpha_box_one')).toBe(true);
    expect(descriptor.foldsColumn('alpha_box_two')).toBe(true);
    expect(descriptor.foldsColumn('alpha_box_three')).toBe(false);
    expect(descriptor.foldsColumn('unrelated')).toBe(false);
  });

  it('a table with no declaration claims nothing', () => {
    const plain = new TenantTableDescriptor('example_table', { id: 'integer' }, false, null, []);
    expect(plain.folds).toEqual([]);
    expect(plain.foldsColumn('alpha_box_one')).toBe(false);
  });

  it('exposes the claimed source columns', () => {
    expect(fold.sources).toEqual(['alpha_box_one', 'alpha_box_two']);
  });
});

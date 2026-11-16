import { describe, expect, it } from 'vitest';
import { FieldRowListService } from '@/components/collection/field-row-list-service';

describe('FieldRowListService', () => {
  const rowFields = [{ name: 'url', type: 'text' }, { name: 'title', type: 'text' }];

  it('reads a json field that declares its sub-fields as rows', () => {
    expect(FieldRowListService.isRowList({ name: 'videos', type: 'json', fields: rowFields } as any)).toBe(true);
  });

  it('leaves a plain json field to the JSON control', () => {
    expect(FieldRowListService.isRowList({ name: 'payload', type: 'json' } as any)).toBe(false);
    expect(FieldRowListService.isRowList({ name: 'payload', type: 'json', fields: [] } as any)).toBe(false);
  });

  it('claims nothing that is not json — `array` is already routed by its type', () => {
    expect(FieldRowListService.isRowList({ name: 'rows', type: 'array', fields: rowFields } as any)).toBe(false);
    expect(FieldRowListService.isRowList({ name: 'title', type: 'text' } as any)).toBe(false);
  });

  it('takes the rows whether the column handed back the array or its text', () => {
    expect(FieldRowListService.rowsOf([{ url: 'a' }])).toEqual([{ url: 'a' }]);
    expect(FieldRowListService.rowsOf('[{"url":"a"}]')).toEqual([{ url: 'a' }]);
  });

  it('gives an empty list for anything that is not rows, rather than throwing', () => {
    for (const value of [null, undefined, '', '   ', 'not json', '{"a":1}', 42, {}]) {
      expect(FieldRowListService.rowsOf(value)).toEqual([]);
    }
  });
});

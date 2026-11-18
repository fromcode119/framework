import { describe, it, expect } from 'vitest';
import { StructuredReadOnlyTableService } from '@/components/collection/fields/structured-read-only-table-service';
import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';

const scalar = (scalarValue: string) => ({ kind: StructuredNodeKind.SCALAR, scalarValue });
const row = { key: scalar('Бяла'), sku: scalar('TS-W'), gtin: scalar('') };

describe('The value a row hands on', () => {
  it('escapes it for a link, because a href is a URL', () => {
    expect(StructuredReadOnlyTableService.rowHref('/stock?search={key}', row)).toBe(
      '/stock?search=%D0%91%D1%8F%D0%BB%D0%B0',
    );
  });

  it('leaves it as the operator reads it for a row key, which is matched and shown as a title', () => {
    expect(StructuredReadOnlyTableService.rowKey('{key}', row)).toBe('Бяла');
  });

  it('resolves to nothing when the row cannot answer the template, so it never keys on the empty string', () => {
    expect(StructuredReadOnlyTableService.rowKey('{gtin}', row)).toBe('');
    expect(StructuredReadOnlyTableService.rowHref('/x?q={gtin}', row)).toBe('');
  });
});


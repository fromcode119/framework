import { describe, it, expect } from 'vitest';
import { SchemaKeyField } from '@database/schema-key-field';

describe('SchemaKeyField', () => {
  it('drops the `{ name: id, type: id }` declaration that suppressed the builder key column', () => {
    const fields = SchemaKeyField.withoutDeclaredKey([
      { name: 'id', type: 'id' },
      { name: 'sitemap_type', type: 'text' },
    ]);

    expect(fields.map((f) => f.name)).toEqual(['sitemap_type']);
  });

  it('drops a key field whatever its declared type, so no spelling slips through', () => {
    expect(SchemaKeyField.isDeclaredKey({ name: 'id', type: 'text' })).toBe(true);
    expect(SchemaKeyField.isDeclaredKey({ name: 'someRef', type: 'id' })).toBe(true);
  });

  it('judges by the snake_cased column the field would produce, so `ID` (→ `_i_d`) is not the key', () => {
    expect(SchemaKeyField.isDeclaredKey({ name: 'ID', type: 'text' })).toBe(false);
  });

  it('keeps columns that merely end in id — they are ordinary data, not the key', () => {
    const fields = SchemaKeyField.withoutDeclaredKey([
      { name: 'affiliateId', type: 'text' },
      { name: 'user_id', type: 'integer' },
      { name: 'paid', type: 'boolean' },
    ]);

    expect(fields.map((f) => f.name)).toEqual(['affiliateId', 'user_id', 'paid']);
  });

  it('leaves a list that declares no key untouched', () => {
    const fields = [{ name: 'label', type: 'text' }];
    expect(SchemaKeyField.withoutDeclaredKey(fields)).toEqual(fields);
  });
});

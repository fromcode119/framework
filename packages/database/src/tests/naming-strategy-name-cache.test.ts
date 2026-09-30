import { describe, expect, it } from 'vitest';
import { NamingStrategy } from '@database/naming-strategy';

// Row keys are renamed on every row of every read; the conversions are remembered. The answers must be
// exactly what the plain conversion gives, first time and every time after, and the memory bounded.
describe('NamingStrategy name conversion cache', () => {
  it('answers the same conversion on the first call and every call after', () => {
    for (let round = 0; round < 3; round += 1) {
      expect(NamingStrategy.toCamelCase('updated_at')).toBe('updatedAt');
      expect(NamingStrategy.toCamelCase('lead_time_max_days')).toBe('leadTimeMaxDays');
      expect(NamingStrategy.toCamelCase('id')).toBe('id');
      expect(NamingStrategy.toSnakeCase('leadTimeMaxDays')).toBe('lead_time_max_days');
      expect(NamingStrategy.toSnakeCase('id')).toBe('id');
    }
  });

  it('keeps the two directions apart', () => {
    expect(NamingStrategy.toSnakeCase('fooBar')).toBe('foo_bar');
    expect(NamingStrategy.toCamelCase('fooBar')).toBe('fooBar');
    expect(NamingStrategy.toCamelCase('foo_bar')).toBe('fooBar');
    expect(NamingStrategy.toSnakeCase('foo_bar')).toBe('foo_bar');
  });

  it('stays correct past its size limit', () => {
    for (let i = 0; i < 10_000; i += 1) expect(NamingStrategy.toCamelCase(`col_${i}_name`)).toBe(`col_${i}Name`);
    expect(NamingStrategy.toCamelCase('created_at')).toBe('createdAt');
    expect((NamingStrategy as any).camelNames.size).toBeLessThanOrEqual(4096);
  });

  it('denormalizes a record as before', () => {
    expect(NamingStrategy.denormalizeRecord({ product_id: 1, updated_at: 'x', name: 'n' })).toEqual({ productId: 1, updatedAt: 'x', name: 'n' });
  });
});

import { describe, it, expect } from 'vitest';
import { CoercionUtils } from '@core/utils/coercion-utils';

/**
 * These tests exist because a product row on production carried `shortDescription: {}` — an object in a
 * string field — and `toString` faithfully rendered "[object Object]" into the storefront card. A value
 * with no meaningful string form must coerce to '', never to stringification junk.
 */
describe('CoercionUtils.toString', () => {
  it('coerces a plain object to empty string, never "[object Object]"', () => {
    expect(CoercionUtils.toString({})).toBe('');
    expect(CoercionUtils.toString({ bg: 'текст' })).toBe('');
  });

  it('coerces an array of objects to empty string', () => {
    expect(CoercionUtils.toString([{}])).toBe('');
  });

  it('passes real strings through trimmed, even ones containing the junk marker', () => {
    expect(CoercionUtils.toString('  Годишен анализ  ')).toBe('Годишен анализ');
    expect(CoercionUtils.toString('literal [object Object] in copy')).toBe('literal [object Object] in copy');
  });

  it('keeps scalar coercions', () => {
    expect(CoercionUtils.toString(30)).toBe('30');
    expect(CoercionUtils.toString(false)).toBe('false');
    expect(CoercionUtils.toString(null)).toBe('');
    expect(CoercionUtils.toString(undefined)).toBe('');
  });

  it('keeps Date stringification so toIsoDateOrNull still resolves dates', () => {
    const date = new Date('2026-08-18T09:30:00.000Z');
    expect(CoercionUtils.toString(date)).not.toBe('');
    expect(CoercionUtils.toIsoDateOrNull(date)).toBe('2026-08-18T09:30:00.000Z');
  });

  it('keeps primitive arrays joining as before', () => {
    expect(CoercionUtils.toString([1, 2])).toBe('1,2');
  });
});

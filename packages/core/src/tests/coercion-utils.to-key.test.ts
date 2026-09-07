import { describe, expect, it } from 'vitest';
import { CoercionUtils } from '@core/coercion-utils';

describe('CoercionUtils.toKey', () => {
  it('gives the comparison form: trimmed and lower-cased', () => {
    expect(CoercionUtils.toKey('  OpenAI  ')).toBe('openai');
    expect(CoercionUtils.toKey('ECONT')).toBe('econt');
  });

  it('answers empty for anything with no meaningful string form, like toString does', () => {
    expect(CoercionUtils.toKey(undefined)).toBe('');
    expect(CoercionUtils.toKey(null)).toBe('');
    // The bracketed-query object that once reached real data as "[object Object]".
    expect(CoercionUtils.toKey({ k: 'v' })).toBe('');
  });

  it('keeps a numeric value rather than losing it', () => {
    expect(CoercionUtils.toKey(0)).toBe('0');
    expect(CoercionUtils.toKey(12)).toBe('12');
  });

  it('is not a slug: what is inside the value survives', () => {
    expect(CoercionUtils.toKey(' Cash On Delivery ')).toBe('cash on delivery');
  });
});

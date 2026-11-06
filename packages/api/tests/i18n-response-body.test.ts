import { describe, expect, it } from 'vitest';
import { I18nManager } from '@fromcode119/core';
import { I18nResponseBody } from '@api/services/system/i18n-response-body';

describe('I18nResponseBody', () => {
  it('serves only the active plugins and reuses the body until a translation changes', () => {
    const i18n = new I18nManager('en');
    i18n.registerTranslations('bg', 'shop', { cart: 'Количка' });
    i18n.registerTranslations('bg', 'other', { secret: 'x' });
    const active = new Set(['shop']);

    const first = I18nResponseBody.for(i18n, 'bg', active);
    expect(JSON.parse(first)).toEqual({ shop: { cart: 'Количка' } });
    expect(I18nResponseBody.for(i18n, 'bg', active)).toBe(first);

    i18n.registerTranslations('bg', 'shop', { cart: 'Кошница' });
    expect(JSON.parse(I18nResponseBody.for(i18n, 'bg', active))).toEqual({ shop: { cart: 'Кошница' } });
  });

  it('keeps one body per set of plugins', () => {
    const i18n = new I18nManager('en');
    i18n.registerTranslations('en', 'a', { k: '1' });
    i18n.registerTranslations('en', 'b', { k: '2' });
    expect(JSON.parse(I18nResponseBody.for(i18n, 'en', new Set(['a'])))).toEqual({ a: { k: '1' } });
    expect(JSON.parse(I18nResponseBody.for(i18n, 'en', new Set(['a', 'b'])))).toEqual({ a: { k: '1' }, b: { k: '2' } });
  });
});

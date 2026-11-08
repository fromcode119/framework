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

  it('serves a regional or script tag the dictionary its language is filed under', () => {
    const i18n = new I18nManager('en');
    i18n.registerTranslations('de', 'shop', { cart: 'Warenkorb' });
    i18n.registerTranslations('zh', 'shop', { cart: '购物车' });
    i18n.registerTranslations('zh-hant', 'shop', { cart: '購物車' });
    const active = new Set(['shop']);
    expect(JSON.parse(I18nResponseBody.for(i18n, 'de-AT', active))).toEqual({ shop: { cart: 'Warenkorb' } });
    expect(JSON.parse(I18nResponseBody.for(i18n, 'zh-TW', active))).toEqual({ shop: { cart: '購物車' } });
    expect(JSON.parse(I18nResponseBody.for(i18n, 'zh-CN', active))).toEqual({ shop: { cart: '购物车' } });
    expect(JSON.parse(I18nResponseBody.for(i18n, 'fr', active))).toEqual({});
  });
});

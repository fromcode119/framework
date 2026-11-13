import { describe, expect, it } from 'vitest';
import { FrontendI18nService } from '@fromcode119/react/context/frontend-i18n-service';

/**
 * A plugin ships its copy as `t(key, params, 'English source')` — the fallback IS the string an
 * operator reads until that key is translated. It used to be returned untouched, so a fallback with a
 * value in it put a literal `{{count}}` on screen; a product picker's honest cap read
 * "Showing the first {{count}} — type to search" instead of naming the number.
 */
describe('a translation fallback is interpolated like a translated string', () => {
  const dictionary = { shop: { picker: { cap: 'Показани са първите {{count}}' } } };

  it('fills the tokens of a default used because the key is missing', () => {
    expect(FrontendI18nService.translate(dictionary, 'shop.picker.absent', { count: 50 }, 'Showing the first {{count}}'))
      .toBe('Showing the first 50');
  });

  it('fills them in a translated string exactly as before', () => {
    expect(FrontendI18nService.translate(dictionary, 'shop.picker.cap', { count: 50 }, 'Showing the first {{count}}'))
      .toBe('Показани са първите 50');
  });

  it('leaves a token with no matching param alone, in either', () => {
    expect(FrontendI18nService.translate(dictionary, 'shop.picker.absent', {}, 'Showing the first {{count}}'))
      .toBe('Showing the first {{count}}');
    expect(FrontendI18nService.translate(dictionary, 'shop.picker.cap', {})).toBe('Показани са първите {{count}}');
  });

  it('still answers the key itself when there is no default', () => {
    expect(FrontendI18nService.translate(dictionary, 'shop.picker.absent', { count: 50 })).toBe('shop.picker.absent');
  });
});

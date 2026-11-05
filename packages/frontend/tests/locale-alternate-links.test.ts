import { describe, expect, it } from 'vitest';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { LocaleAlternateLinks } from '@/lib/locale-alternate-links';

describe('LocaleAlternateLinks.links', () => {
  it('prefixes every non-default locale on the path strategy and keeps the bare path as x-default', () => {
    expect(LocaleAlternateLinks.links('https://shop.example', '/services', LocaleUrlStrategy.PATH, ['bg', 'en'], 'bg')).toEqual({
      bg: 'https://shop.example/services',
      en: 'https://shop.example/en/services',
      'x-default': 'https://shop.example/services',
    });
  });

  it('addresses the home page by the bare locale prefix', () => {
    expect(LocaleAlternateLinks.links('https://shop.example', '/', LocaleUrlStrategy.PATH, ['en', 'bg'], 'en')).toEqual({
      en: 'https://shop.example/',
      bg: 'https://shop.example/bg',
      'x-default': 'https://shop.example/',
    });
  });

  it('uses the locale query on the query strategy', () => {
    expect(LocaleAlternateLinks.links('https://shop.example', 'about', LocaleUrlStrategy.QUERY, ['bg', 'en'], 'bg').en)
      .toBe('https://shop.example/about?locale=en');
  });
});

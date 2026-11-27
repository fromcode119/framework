import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
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

describe('LocaleAlternateLinks.canonical', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const site = (strategy: LocaleUrlStrategy) => {
    vi.spyOn(DynamicPageResolver, 'getLocaleRoutingConfig').mockResolvedValue({ strategy, enabledLocales: new Set(['en', 'bg']) });
    vi.spyOn(FrontendLocaleService, 'readDefaultLocale').mockResolvedValue('en');
  };

  it('names the page in the language it is read in', async () => {
    site(LocaleUrlStrategy.PATH);
    expect(await LocaleAlternateLinks.canonical('https://shop.example/', 'bg')).toBe('https://shop.example/bg');
    expect(await LocaleAlternateLinks.canonical('https://shop.example/terms', 'bg')).toBe('https://shop.example/bg/terms');
  });

  it('leaves the default language and an address already naming a language alone', async () => {
    site(LocaleUrlStrategy.PATH);
    expect(await LocaleAlternateLinks.canonical('https://shop.example/terms', 'en')).toBe('https://shop.example/terms');
    expect(await LocaleAlternateLinks.canonical('https://shop.example/bg/terms', 'bg')).toBe('https://shop.example/bg/terms');
  });
});

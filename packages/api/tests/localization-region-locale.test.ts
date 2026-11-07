import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseCache, RequestContextUtils } from '@fromcode119/core';
import { LocalizationService } from '@api/services/localization-service';

/**
 * A request names a locale with its region (`en-US`, `zh-TW`, `fil-PH`); a translation is stored under its
 * language and script. The read must reach that translation before the site's default language.
 */
describe('LocalizationService reads a region locale in its language', () => {
  beforeEach(() => { ApiResponseCache.reset(); ApiResponseCache.useMaxAge(() => 60); });
  afterEach(() => ApiResponseCache.reset());

  const svc = new LocalizationService({ find: vi.fn(async () => [{ key: 'default_locale', value: 'bg' }]) } as any);
  const collection = { fields: [{ name: 'name', localized: true }] } as any;
  const name = { bg: 'Следобед', en: 'Afternoon', zh: '午后', 'zh-hant': '午後', fil: 'Hapon' };
  const read = (locale: string) => RequestContextUtils.storage.run({ tenantId: `site-${locale}` } as any, async () => {
    const localeContext = await svc.getLocaleContext({ query: { locale }, headers: {} });
    return svc.transformOutgoingData(collection, { name }, { localeContext, rawLocalized: false }).name;
  });

  it.each([
    ['en-US', 'Afternoon'],
    ['zh-TW', '午後'],
    ['zh-Hant-HK', '午後'],
    ['zh-CN', '午后'],
    ['fil-PH', 'Hapon'],
    ['bg', 'Следобед'],
  ])('%s reads %s', async (locale, expected) => {
    expect(await read(locale)).toBe(expected);
  });

  it('a Traditional Chinese reader with no Traditional text reads Simplified, not the default', async () => {
    const context = await RequestContextUtils.storage.run({ tenantId: 'site-x' } as any, () => svc.getLocaleContext({ query: { locale: 'zh-TW' }, headers: {} }));
    expect(svc.transformOutgoingData(collection, { name: { bg: 'Следобед', zh: '午后' } }, { localeContext: context, rawLocalized: false }).name).toBe('午后');
  });
});

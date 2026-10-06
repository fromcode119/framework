import { describe, expect, it } from 'vitest';
import { I18nContextProxy } from '@core/plugin/context/i18n';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * A plugin that keeps a value it derived from `localized` reads (a prepared page) must file it under the
 * language those reads resolved in — and a plugin could not ask which that was. `currentLocale()` answers
 * the way the framework's own reads do, so what is kept is found again under the same name.
 */
describe('context.i18n.currentLocale', () => {
  const i18n: any = I18nContextProxy.createI18nProxy(
    { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any,
    { i18n: { getDefaultLocale: () => 'en' } } as any,
    { currentPluginRoot: '/nowhere' } as any,
    { hasCapability: () => true, handleViolation: () => undefined } as any,
  );
  const readIn = (locale: string | undefined) => RequestContextUtils.storage.run({ locale } as any, () => i18n.currentLocale());

  it('is the short code of the request\'s language', () => {
    expect(readIn('bg')).toBe('bg');
    expect(readIn('en-GB')).toBe('en');
    expect(readIn('BG_bg')).toBe('bg');
  });

  it('is empty when the work names no language', () => {
    expect(readIn(undefined)).toBe('');
    expect(readIn('')).toBe('');
    expect(i18n.currentLocale()).toBe('');
  });
});

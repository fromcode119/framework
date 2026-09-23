import { describe, expect, it } from 'vitest';
import { PlatformCountryUtils } from '@core/utils/platform-country-utils';
import { PlatformCountrySource } from '@core/enums/platform-country-source.enum';

describe('PlatformCountryUtils', () => {
  it('uses the country the operator set, over anything the language implies', () => {
    const resolved = PlatformCountryUtils.resolve({ country: 'de', frontend_default_locale: 'bg' });
    expect(resolved).toEqual({ country: 'DE', source: PlatformCountrySource.SETTING, language: '' });
  });

  it('with no country set, derives it from the frontend language, then the default language', () => {
    expect(PlatformCountryUtils.resolve({ frontend_default_locale: 'bg', default_locale: 'en' }))
      .toEqual({ country: 'BG', source: PlatformCountrySource.LANGUAGE, language: 'bg' });
    expect(PlatformCountryUtils.resolve({ country: '', default_locale: 'de-AT' }).country).toBe('AT');
    expect(PlatformCountryUtils.fromLocale('pt_BR')).toBe('BR');
  });

  it('says NONE rather than inventing a country when nothing resolves', () => {
    expect(PlatformCountryUtils.resolve({})).toEqual({ country: '', source: PlatformCountrySource.NONE, language: '' });
    expect(PlatformCountryUtils.resolve(null).source).toBe(PlatformCountrySource.NONE);
    expect(PlatformCountryUtils.fromLocale('not a locale!!')).toBe('');
  });

  it('accepts only ISO alpha-2 codes', () => {
    expect(PlatformCountryUtils.normalize(' bg ')).toBe('BG');
    expect(PlatformCountryUtils.normalize('001')).toBe('');
    expect(PlatformCountryUtils.normalize('BGR')).toBe('');
  });

  it('reads through a plugin meta store, and a module override wins over the platform country', async () => {
    const stored: Record<string, string | null> = { country: null, frontend_default_locale: 'bg', default_locale: 'en' };
    const meta = { get: async (key: string) => stored[key] ?? null };

    expect((await PlatformCountryUtils.read(meta)).country).toBe('BG');
    expect(await PlatformCountryUtils.forModule('', meta)).toBe('BG');
    expect(await PlatformCountryUtils.forModule('de', meta)).toBe('DE');
  });
});

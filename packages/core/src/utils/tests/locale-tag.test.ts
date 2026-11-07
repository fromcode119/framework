import { describe, expect, it } from 'vitest';
import { LocaleTag } from '@core/utils/locale-tag';
import { LocalizationUtils } from '@core/localization';

/**
 * Translations are keyed by language, plus script when the script changes what a reader can read. Before
 * this, every code was cut to two letters: Filipino (`fil`) was not a locale at all — a translation map
 * holding it stopped being read as one — and Traditional Chinese folded into Simplified.
 */
describe('LocaleTag', () => {
  it('keys a region variant by its language', () => {
    expect(LocaleTag.key('en-US')).toBe('en');
    expect(LocaleTag.key('pt_BR')).toBe('pt');
    expect(LocaleTag.key('bg')).toBe('bg');
  });

  it('keeps a script that is not the language’s usual one, named or implied by the region', () => {
    expect(LocaleTag.key('zh-Hant')).toBe('zh-hant');
    expect(LocaleTag.key('zh-TW')).toBe('zh-hant');
    expect(LocaleTag.key('zh-Hant-HK')).toBe('zh-hant');
    expect(LocaleTag.key('sr-Latn')).toBe('sr-latn');
  });

  it('drops a script that is the usual one', () => {
    expect(LocaleTag.key('zh-Hans')).toBe('zh');
    expect(LocaleTag.key('zh-CN')).toBe('zh');
    expect(LocaleTag.key('sr-Cyrl')).toBe('sr');
  });

  it('reads a three-letter language only when it has no two-letter code and is a language', () => {
    expect(LocaleTag.key('fil')).toBe('fil');
    expect(LocaleTag.key('fil-PH')).toBe('fil');
    expect(LocaleTag.key('yue')).toBe('yue');
    expect(LocaleTag.key('eng')).toBe('');
    expect(LocaleTag.key('max')).toBe('');
    expect(LocaleTag.key('faq')).toBe('');
    expect(LocaleTag.key('cms')).toBe('');
  });

  it('knows which way a language is written', () => {
    for (const rtl of ['ar', 'he', 'fa', 'ur', 'ar-EG', 'he-IL', 'az-Arab', 'pa-Arab']) expect(LocaleTag.direction(rtl).value).toBe('rtl');
    for (const ltr of ['en', 'bg', 'zh-hant', 'fil', 'az', 'pa', 'th', '', 'max']) expect(LocaleTag.direction(ltr).value).toBe('ltr');
  });

  it('refuses a tag longer than any real one', () => {
    expect(LocaleTag.key(`en-${'a'.repeat(40)}`)).toBe('');
  });
});

describe('LocalizationUtils with script and three-letter locales', () => {
  it('recognises a translation map holding fil and zh-hant', () => {
    expect(LocalizationUtils.isLocaleMap({ en: 'Hi', fil: 'Kumusta', 'zh-hant': '你好' })).toBe(true);
    expect(LocalizationUtils.isLocaleMap({ max: 1, min: 0 })).toBe(false);
  });

  it('reads Traditional Chinese apart from Simplified, and falls back to the language', () => {
    const map = { en: 'Calm', zh: '平静', 'zh-hant': '平靜' };
    expect(LocalizationUtils.resolveLabel(map, 'zh-TW')).toBe('平靜');
    expect(LocalizationUtils.resolveLabel(map, 'zh-Hant')).toBe('平靜');
    expect(LocalizationUtils.resolveLabel(map, 'zh')).toBe('平静');
    expect(LocalizationUtils.resolveLabel({ en: 'Calm', zh: '平静' }, 'zh-Hant')).toBe('平静');
    expect(LocalizationUtils.readLocalizedValue({ en: 'Calm', zh: '平静' }, 'zh-TW')).toBe('平静');
  });

  it('reads Filipino', () => {
    expect(LocalizationUtils.resolveLabel({ en: 'Calm', fil: 'Kalmado' }, 'fil-PH')).toBe('Kalmado');
    expect(LocalizationUtils.normalizeLocaleCode('fil')).toBe('fil');
  });

  it('keeps a written map’s keys apart when writing one locale', () => {
    expect(LocalizationUtils.writeLocalizedValue({ zh: '平静' }, 'zh-Hant', '平靜')).toEqual({ zh: '平静', 'zh-hant': '平靜' });
  });
});

import { describe, expect, it } from 'vitest';
import { FrameworkTranslations } from '@fromcode119/react/i18n/framework-translations';

/**
 * A server render has no `<html lang>`, so the detected locale is always English there. A surface that
 * renders on the server passes its route's document locale instead, or the markup disagrees with the
 * first client render and React discards it.
 */
describe('FrameworkTranslations.in with an explicit locale', () => {
  FrameworkTranslations.registerAll({ en: { probe: { word: 'Loading' } }, bg: { probe: { word: 'Зареждане' } } });

  it('resolves the passed locale on the server, where detection always says English', () => {
    expect(FrameworkTranslations.t('probe.word')).toBe('Loading');
    expect(FrameworkTranslations.in('bg', 'probe.word')).toBe('Зареждане');
  });

  it('treats a regional code as its language and falls back to English for an unknown one', () => {
    expect(FrameworkTranslations.in('bg-BG', 'probe.word')).toBe('Зареждане');
    expect(FrameworkTranslations.in('de', 'probe.word')).toBe('Loading');
  });
});

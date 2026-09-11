import { describe, expect, it } from 'vitest';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/**
 * The console's own copy, which must work before there is a database: `/system/i18n` serves PLUGIN
 * dictionaries filtered to ACTIVE plugins, so on a fresh installation it answers `{}` — and the
 * first-run wizard is exactly the screen that runs then.
 */
describe('AdminDictionary', () => {
  it('offers the locales it actually ships, so the picker cannot promise a language with no words', () => {
    expect(AdminDictionary.locales.sort()).toEqual(['bg', 'en']);
    expect(AdminDictionary.has('bg')).toBe(true);
    expect(AdminDictionary.has('de')).toBe(false);
  });

  it('translates, and falls back to English rather than rendering blank', () => {
    expect(AdminDictionary.translate('bg', 'setup.actions.back')).toBe('Назад');
    expect(AdminDictionary.translate('en', 'setup.actions.back')).toBe('Back');
    expect(AdminDictionary.translate('de', 'setup.actions.back')).toBe('Back');
  });

  it('returns the key itself when nothing defines it, so a missing string is visible', () => {
    expect(AdminDictionary.translate('en', 'setup.nothing.here')).toBe('setup.nothing.here');
  });

  it('resolves a regional tag to the base language it ships', () => {
    expect(AdminDictionary.translate('bg-BG', 'setup.steps.language')).toBe('Език');
  });

  it('names each language in that language, which is the only name its reader recognises', () => {
    expect(AdminDictionary.label('bg').toLowerCase()).toContain('български');
  });
});

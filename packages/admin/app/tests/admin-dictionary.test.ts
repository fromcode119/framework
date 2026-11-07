import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/**
 * The console's own copy, which must work before there is a database: `/system/i18n` serves PLUGIN
 * dictionaries filtered to ACTIVE plugins, so on a fresh installation it answers `{}` — and the
 * first-run wizard is exactly the screen that runs then.
 */
describe('AdminDictionary', () => {
  const shipped = fs.readdirSync(path.resolve(__dirname, '../../i18n'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();

  it('offers exactly the dictionaries it ships, so the picker cannot promise a language with no words', () => {
    expect([...AdminDictionary.locales].sort()).toEqual(shipped);
    expect(AdminDictionary.has('de')).toBe(true);
    expect(AdminDictionary.has('zh-TW')).toBe(true);
    expect(AdminDictionary.has('xx')).toBe(false);
  });

  it('keeps English and Bulgarian in the bundle and fetches every other language when it is chosen', async () => {
    expect(AdminDictionary.isLoaded('en')).toBe(true);
    expect(AdminDictionary.isLoaded('bg')).toBe(true);
    expect(AdminDictionary.isLoaded('de')).toBe(false);
    expect(AdminDictionary.translate('de', 'setup.actions.back')).toBe('Back');
    await AdminDictionary.load('de-AT');
    expect(AdminDictionary.isLoaded('de')).toBe(true);
    expect(AdminDictionary.translate('de', 'setup.actions.back')).toBe('Zurück');
  });

  it('files Traditional Chinese apart from Simplified, by script', async () => {
    await AdminDictionary.load('zh-TW');
    expect(AdminDictionary.isLoaded('zh-hant')).toBe(true);
    expect(AdminDictionary.isLoaded('zh')).toBe(false);
  });

  it('resolves at once for a language it does not ship, whose readers see English', async () => {
    await AdminDictionary.load('xx');
    expect(AdminDictionary.translate('xx', 'setup.actions.back')).toBe('Back');
  });

  it('translates, and falls back to English rather than rendering blank', () => {
    expect(AdminDictionary.translate('bg', 'setup.actions.back')).toBe('Назад');
    expect(AdminDictionary.translate('en', 'setup.actions.back')).toBe('Back');
  });

  it('returns the key itself when nothing defines it, so a missing string is visible', () => {
    expect(AdminDictionary.translate('en', 'setup.nothing.here')).toBe('setup.nothing.here');
  });

  it('resolves a regional tag to the base language it ships', () => {
    expect(AdminDictionary.translate('bg-BG', 'setup.steps.language')).toBe('Език');
  });

  it('lays out Arabic and Hebrew right to left, and everything else left to right', () => {
    expect(AdminDictionary.direction('ar').value).toBe('rtl');
    expect(AdminDictionary.direction('he-IL').value).toBe('rtl');
    expect(AdminDictionary.direction('bg').value).toBe('ltr');
    expect(AdminDictionary.direction('zh-hant').value).toBe('ltr');
  });

  it('names each language in that language, which is the only name its reader recognises', () => {
    expect(AdminDictionary.label('bg')).toBe('Български');
  });
});

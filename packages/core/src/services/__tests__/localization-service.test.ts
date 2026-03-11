import { describe, it, expect, beforeEach } from 'vitest';
import { LocalizationService } from '../localization-service';

describe('LocalizationService', () => {
  let service: LocalizationService;

  beforeEach(() => {
    service = new LocalizationService();
  });

  describe('normalizeLocale', () => {
    it('converts underscore to dash', () => {
      expect(service.normalizeLocale('en_US')).toBe('en-us');
      expect(service.normalizeLocale('pt_BR')).toBe('pt-br');
    });

    it('converts to lowercase', () => {
      expect(service.normalizeLocale('EN-US')).toBe('en-us');
      expect(service.normalizeLocale('FR')).toBe('fr');
    });

    it('trims whitespace', () => {
      expect(service.normalizeLocale('  en-us  ')).toBe('en-us');
      expect(service.normalizeLocale('\ten\t')).toBe('en');
    });

    it('handles empty strings', () => {
      expect(service.normalizeLocale('')).toBe('');
      expect(service.normalizeLocale('   ')).toBe('');
    });

    it('handles non-string values', () => {
      expect(service.normalizeLocale(null)).toBe('');
      expect(service.normalizeLocale(undefined)).toBe('');
      expect(service.normalizeLocale(123 as any)).toBe('123');
    });

    it('preserves valid locale codes', () => {
      expect(service.normalizeLocale('en')).toBe('en');
      expect(service.normalizeLocale('en-us')).toBe('en-us');
      expect(service.normalizeLocale('zh-cn')).toBe('zh-cn');
    });
  });

  describe('isLocaleKey', () => {
    it('validates standard locale codes', () => {
      expect(service.isLocaleKey('en')).toBe(true);
      expect(service.isLocaleKey('en-US')).toBe(true);
      expect(service.isLocaleKey('pt-BR')).toBe(true);
      expect(service.isLocaleKey('zh-Hans-CN')).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(service.isLocaleKey('')).toBe(false);
      expect(service.isLocaleKey('1')).toBe(false);
      expect(service.isLocaleKey('e')).toBe(false);
      expect(service.isLocaleKey('english')).toBe(false);
      expect(service.isLocaleKey('en_US')).toBe(false); // underscore not allowed
    });

    it('rejects whitespace', () => {
      expect(service.isLocaleKey('en us')).toBe(false); // space in middle
    });

    it('handles edge cases', () => {
      expect(service.isLocaleKey('aa')).toBe(true); // minimum 2 chars
      expect(service.isLocaleKey('aaa')).toBe(true); // 3 chars also valid
    });
  });

  describe('isMeaningful', () => {
    it('detects meaningful strings', () => {
      expect(service.isMeaningful('Hello')).toBe(true);
      expect(service.isMeaningful('0')).toBe(true); // "0" is meaningful
      expect(service.isMeaningful(' text ')).toBe(true);
    });

    it('rejects empty strings', () => {
      expect(service.isMeaningful('')).toBe(false);
      expect(service.isMeaningful('   ')).toBe(false);
      expect(service.isMeaningful('\t\n')).toBe(false);
    });

    it('detects meaningful arrays', () => {
      expect(service.isMeaningful([1, 2, 3])).toBe(true);
      expect(service.isMeaningful(['a'])).toBe(true);
    });

    it('rejects empty arrays', () => {
      expect(service.isMeaningful([])).toBe(false);
    });

    it('detects meaningful objects', () => {
      expect(service.isMeaningful({ key: 'value' })).toBe(true);
      expect(service.isMeaningful({ a: 1 })).toBe(true);
    });

    it('rejects empty objects', () => {
      expect(service.isMeaningful({})).toBe(false);
    });

    it('handles null and undefined', () => {
      expect(service.isMeaningful(null)).toBe(false);
      expect(service.isMeaningful(undefined)).toBe(false);
    });

    it('considers numbers and booleans meaningful', () => {
      expect(service.isMeaningful(0)).toBe(true); // 0 is meaningful
      expect(service.isMeaningful(42)).toBe(true);
      expect(service.isMeaningful(true)).toBe(true);
      expect(service.isMeaningful(false)).toBe(true);
    });
  });

  describe('resolveText', () => {
    it('returns strings as-is', () => {
      expect(service.resolveText('Hello')).toBe('Hello');
      expect(service.resolveText('World')).toBe('World');
    });

    it('converts numbers to strings', () => {
      expect(service.resolveText(123 as any)).toBe('123');
      expect(service.resolveText(0 as any)).toBe('0');
    });

    it('converts booleans to strings', () => {
      expect(service.resolveText(true as any)).toBe('true');
      expect(service.resolveText(false as any)).toBe('false');
    });

    it('handles null and undefined', () => {
      expect(service.resolveText(null)).toBe('');
      expect(service.resolveText(undefined)).toBe('');
    });

    it('resolves locale maps with exact match', () => {
      const localeMap = { en: 'Hello', bg: 'Здравей', fr: 'Bonjour' };
      expect(service.resolveText(localeMap, 'en')).toBe('Hello');
      expect(service.resolveText(localeMap, 'bg')).toBe('Здравей');
      expect(service.resolveText(localeMap, 'fr')).toBe('Bonjour');
    });

    it('resolves locale maps with normalized keys', () => {
      const localeMap = { 'en-us': 'Hello', 'pt-br': 'Olá' };
      expect(service.resolveText(localeMap, 'en_US')).toBe('Hello'); // normalizes to en-us
      expect(service.resolveText(localeMap, 'PT-BR')).toBe('Olá'); // normalizes to pt-br
    });

    it('falls back to language-only match', () => {
      const localeMap = { en: 'Hello', bg: 'Здравей' };
      expect(service.resolveText(localeMap, 'en-US')).toBe('Hello'); // en-us → en
      expect(service.resolveText(localeMap, 'en-GB')).toBe('Hello'); // en-gb → en
    });

    it('falls back to first available value', () => {
      const localeMap = { bg: 'Здравей', fr: 'Bonjour' };
      const result = service.resolveText(localeMap, 'de'); // no match, get first
      expect(['Здравей', 'Bonjour']).toContain(result);
      expect(result).toBeTruthy();
    });

    it('handles empty locale maps', () => {
      expect(service.resolveText({}, 'en')).toBe('');
    });

    it('handles arrays by returning first meaningful value', () => {
      expect(service.resolveText(['First', 'Second'])).toBe('First');
      expect(service.resolveText([null, 'Second', 'Third'])).toBe('Second');
      expect(service.resolveText([{ en: 'Hello' }], 'en')).toBe('Hello');
    });

    it('handles nested locale maps in arrays', () => {
      const data = [{ en: 'Hi', bg: 'Здрасти' }, { en: 'Hello', bg: 'Здравей' }];
      expect(service.resolveText(data, 'en')).toBe('Hi'); // first match
      expect(service.resolveText(data, 'bg')).toBe('Здрасти'); // first match
    });

    it('handles complex nested structures', () => {
      const data = {
        en: { nested: 'Hello' },
        bg: 'Здравей'
      };
      // Should resolve en → { nested: 'Hello' } → recurse → 'Hello'
      expect(service.resolveText(data, 'en')).toBe('Hello');
      expect(service.resolveText(data, 'bg')).toBe('Здравей');
    });

    it('handles missing preferred locale', () => {
      const localeMap = { en: 'Hello', bg: 'Здравей' };
      const result = service.resolveText(localeMap); // no preferred locale
      expect(['Hello', 'Здравей']).toContain(result);
    });
  });
});

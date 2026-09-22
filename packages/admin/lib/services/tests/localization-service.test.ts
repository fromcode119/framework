import { describe, expect, it } from 'vitest';
import { LocalizationService } from '@/lib/services/localization-service';

/**
 * An installation with NO locale configured — no `admin_default_locale`, no `default_locale`, an
 * empty registry — used to resolve the admin locale to ''. Every localized field then read its
 * value through `toLocaleMap(value, '')`, which returns {} for a plain string, so a CMS page's
 * title rendered EMPTY and pressing Save wrote `{ '': '<text>' }` over it.
 */
describe('LocalizationService.resolveAdminLocale', () => {
  const service = new LocalizationService();

  it('never resolves to an empty locale when nothing is configured', () => {
    expect(service.resolveAdminLocale({}, [])).not.toBe('');
    expect(service.resolveAdminLocale(undefined, undefined)).not.toBe('');
  });

  it('still honours a configured locale, then the registry, before the fallback', () => {
    expect(service.resolveAdminLocale({ admin_default_locale: 'bg' }, [])).toBe('bg');
    expect(service.resolveAdminLocale({}, [{ code: 'de', label: 'Deutsch' }])).toBe('de');
  });
});

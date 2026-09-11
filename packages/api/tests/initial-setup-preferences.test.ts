import { describe, expect, it } from 'vitest';
import { InitialSetupPreferences } from '@api/controllers/auth/initial-setup-preferences';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The first-run wizard is the ONE place these three settings can be written without an operator
 * being able to see the screen that owns them, so what it stores has to be exactly what was asked
 * for — never a value nobody chose, and never a value the rest of the platform cannot read back.
 */
describe('InitialSetupPreferences', () => {
  const keyed = (body: Record<string, unknown>) => Object.fromEntries(InitialSetupPreferences.fromRequestBody(body).entries);

  it('writes nothing when the wizard sent nothing', () => {
    expect(keyed({})).toEqual({});
    expect(Object.fromEntries(InitialSetupPreferences.fromRequestBody(undefined).entries)).toEqual({});
  });

  it('stores the three answers under the keys Settings already owns', () => {
    expect(keyed({ locale: 'bg', platformName: 'Vselenski Portal', timezone: 'Europe/Sofia' })).toEqual({
      [SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE]: 'bg',
      [SystemConstants.META_KEY.PLATFORM_NAME]: 'Vselenski Portal',
      [SystemConstants.META_KEY.TIMEZONE]: 'Europe/Sofia',
    });
  });

  it('keeps a blank answer blank rather than inventing one', () => {
    expect(keyed({ locale: '', platformName: '   ', timezone: '' })).toEqual({});
  });

  it('drops a timezone the runtime cannot resolve, because every later date would format against it', () => {
    expect(keyed({ timezone: 'Middle/Earth' })).toEqual({});
    expect(keyed({ timezone: 'America/Sao_Paulo' })).toEqual({
      [SystemConstants.META_KEY.TIMEZONE]: 'America/Sao_Paulo',
    });
  });

  it('drops a locale that is not a language tag, and lowercases the ones that are', () => {
    expect(keyed({ locale: 'not a locale' })).toEqual({});
    expect(keyed({ locale: '../../etc/passwd' })).toEqual({});
    expect(keyed({ locale: 'pt-BR' })).toEqual({ [SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE]: 'pt-br' });
  });

  it('caps the platform name instead of storing an unbounded string', () => {
    const stored = keyed({ platformName: 'x'.repeat(500) })[SystemConstants.META_KEY.PLATFORM_NAME];
    expect(String(stored).length).toBe(120);
  });
});

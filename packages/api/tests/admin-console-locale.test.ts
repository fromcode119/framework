import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { AdminConsoleLocale } from '@api/services/system/admin-console-locale';

/**
 * The console speaks the READER's language: their own choice, else the site's "Admin default locale".
 * A shared payload must never carry one person's choice, so the site default stands on its own.
 */
describe('AdminConsoleLocale', () => {
  const manager = (preferredLocale: string | null, adminDefault: string | null) => ({
    db: {
      findOne: async (table: string, where: Record<string, unknown>) =>
        (table === SystemConstants.TABLE.PEOPLE && where.userId === 7 ? { preferred_locale: preferredLocale } : null),
      find: async () => (adminDefault === null ? [] : [{ key: SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE, value: adminDefault }]),
    },
  }) as any;

  it("uses the person's own language over the site's default", async () => {
    expect(await AdminConsoleLocale.resolve(manager('BG', 'en'), { user: { id: 7 } })).toBe('bg');
  });

  it("falls back to the site's default when the person has not chosen", async () => {
    expect(await AdminConsoleLocale.resolve(manager('', 'en'), { user: { id: 7 } })).toBe('en');
    expect(await AdminConsoleLocale.resolve(manager(null, 'bg'), { user: { id: 7 } })).toBe('bg');
  });

  it('uses the site default when nobody is signed in, and nothing when neither is set', async () => {
    expect(await AdminConsoleLocale.resolve(manager('bg', 'en'), {})).toBe('en');
    expect(await AdminConsoleLocale.resolve(manager('', null), { user: { id: 7 } })).toBe('');
  });

  it("gives a shared payload the site's default, never a person's choice", async () => {
    expect(await AdminConsoleLocale.siteDefault(manager('bg', 'en'))).toBe('en');
  });
});

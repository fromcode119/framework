import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { SystemSettingsController } from '@api/controllers/system/system-settings-controller';

/**
 * Every key the General settings page sends must be writable.
 *
 * The PUT rejects the WHOLE payload when it carries a key this list does not name, so a key missing
 * here does not lose one toggle — it stops the entire page from saving. That has happened twice now:
 * once for `measurement_system`, and once for `admin_search_indexing`, which was added to the form
 * and the constants and not to this list, so saving General settings answered 400.
 */
describe('SystemSettingsController — writable settings keys', () => {
  const writable = (SystemSettingsController as any).WRITABLE_SETTINGS_KEYS as Set<string>;

  it.each([
    ['admin_search_indexing', SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING],
    ['email_notifications', SystemConstants.META_KEY.EMAIL_NOTIFICATIONS],
    ['measurement_system', SystemConstants.META_KEY.MEASUREMENT_SYSTEM],
    ['timezone', SystemConstants.META_KEY.TIMEZONE],
  ])('accepts %s, which the General page always sends', (_label, key) => {
    expect(writable.has(key)).toBe(true);
  });
});

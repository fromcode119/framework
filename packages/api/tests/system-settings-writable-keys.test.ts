import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { SystemSettingsController } from '@api/controllers/system/system-settings-controller';

/**
 * Every key the General settings page sends must be writable.
 *
 * The PUT rejects the WHOLE payload when it carries a key this list does not name, so a key missing
 * here does not lose one toggle — it stops the entire page from saving. That has happened twice now:
 * once for `measurement_system`, and again for `framework_repository` and `sources_workspace_root`,
 * which the General page has always sent and this list never named — so EVERY save from that page
 * answered 400, and the Sources workspace root could be typed in and never take effect.
 */
describe('SystemSettingsController — writable settings keys', () => {
  const writable = (SystemSettingsController as any).WRITABLE_SETTINGS_KEYS as Set<string>;

  it.each([
    ['admin_search_indexing', SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING],
    ['framework_repository', SystemConstants.META_KEY.FRAMEWORK_REPOSITORY],
    ['sources_workspace_root', SystemConstants.META_KEY.SOURCES_WORKSPACE_ROOT],
    ['email_notifications', SystemConstants.META_KEY.EMAIL_NOTIFICATIONS],
    ['measurement_system', SystemConstants.META_KEY.MEASUREMENT_SYSTEM],
    ['timezone', SystemConstants.META_KEY.TIMEZONE],
  ])('accepts %s, which the General page always sends', (_label, key) => {
    expect(writable.has(key)).toBe(true);
  });
});

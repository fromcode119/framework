import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { SystemSettingsWriter } from '@api/controllers/system/system-settings-writer';

/**
 * Every key the General settings page sends must be writable.
 *
 * The PUT rejects the WHOLE payload when it carries a key the controller does not accept, so a
 * missing key does not lose one toggle — it stops the entire page from saving. That happened twice:
 * once for `measurement_system`, and again for `framework_repository` and `sources_workspace_root`,
 * which the General page has always sent — so EVERY save from that page answered 400, and the
 * Sources workspace root could be typed in and never take effect.
 *
 * The hand-written list is gone; the controller now derives this from `SystemSettingRegistry`, where
 * `writable` is declared beside `scope`. These cases stay because they name the keys that actually
 * burned us, and they would still fail if a key were marked unwritable by mistake.
 */
describe('SystemSettingsWriter — writable settings keys', () => {
  // Reaches the private accessor rather than a copy of the list: the point is what the CONTROLLER
  // will accept, not what the registry says in isolation.
  const writable = SystemSettingsWriter.writableKeys() as Set<string>;

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

import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';

/**
 * Framework-owned decision of WHICH `_system_meta` rows may leave the server in an
 * admin/settings response.
 *
 * `_system_meta` is not a settings table — it is the framework's key/value scratch space. Alongside
 * the operator-visible settings it also holds credential blobs (`integration_*` profiles, which store
 * a live SMTP/gateway password), per-user secrets (`user:<id>:totp_secret`, `user:<id>:2fa_recovery_codes`,
 * `user:<id>:api_tokens`), machine tokens (`scim:token`, `auth:api_token:<hash>`) and internal
 * bookkeeping (dedupe timestamps). Dumping the table is therefore a credential disclosure, and a
 * `startsWith('integration_')` deny-list only covers the first of those categories.
 *
 * The rule is an ALLOW-list, derived from the declared settings themselves: a row is exposable only
 * when {@link SystemSettingRegistry} declares its key `exposed`. Nothing new leaks by being written
 * to the table, and there is no second list to keep in sync.
 *
 * That declaration replaced a `startsWith('integration_')` test. A prefix standing in for a property
 * is the same mistake as scope-by-omission one layer over: it happened to name every credential blob
 * we had, and would have silently exposed the next one stored under any other prefix. The registry
 * says it per key, beside `scope` and `writable`, so a new credential that forgets to say so does not
 * compile at all.
 */
export class SystemSettingsExposureUtils {
  /** Every declared system setting key that is safe to return to an admin client. */
  static getExposableKeys(): Set<string> {
    return SystemSettingRegistry.exposedKeys();
  }

  /** True when this `_system_meta` key is a declared, operator-visible setting. */
  static isExposable(key: unknown): boolean {
    return SystemSettingsExposureUtils.getExposableKeys().has(String(key ?? '').trim());
  }

  /**
   * Reduce raw `_system_meta` rows to the exposable settings map. `parseJson` opts into parsing
   * `{`/`[` values back into objects (what the admin settings screen expects); the metadata endpoint
   * passes the stored strings through untouched.
   */
  static toExposableSettingsMap(rows: unknown, options: { parseJson?: boolean } = {}): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = String((row as any)?.key ?? '').trim();
      if (!SystemSettingsExposureUtils.isExposable(key)) continue;
      const value = (row as any)?.value;
      map[key] = options.parseJson ? SystemSettingsExposureUtils.parseStoredValue(value) : value;
    }
    return map;
  }

  /** `_system_meta.value` is stored as text; JSON-shaped values are handed back parsed. */
  private static parseStoredValue(value: unknown): unknown {
    const trimmed = CoercionUtils.toString(value);
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
}

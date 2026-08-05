/**
 * Reconciles stored plugin settings whose keys predate a rename, against the schema the plugin
 * declares today.
 *
 * Settings keys were historically snake_case; plugins have moved to camelCase. Every install still
 * holds the old names, and a plugin reading `taxRatePercent` against a stored `tax_rate_percent`
 * sees nothing and silently falls back to its default — a 0% VAT rate on invoices, in that example.
 *
 * This is deliberately framework-owned rather than a migration class per plugin: it is generic
 * cross-cutting work, and ten near-identical copies is ten places to forget a field. It is also
 * SCHEMA-DRIVEN, not a blind camelCase sweep — a stored key is only ever moved onto a name the
 * plugin actually declares, so a free-form key nobody declared is left exactly as it is.
 *
 * Applied at READ time, so the correct value is returned on the very first `get()` regardless of
 * when the cleanup write lands.
 */
export class PluginSettingsKeyMigrationService {
  private static toCamelCase(key: string): string {
    return key.replace(/_([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
  }

  /**
   * Returns the stored settings with legacy keys resolved onto their declared schema names, plus the
   * list of keys that moved (empty when there is nothing to do, which is the steady state).
   */
  static reconcile(
    storedSettings: Record<string, unknown>,
    schema: { fields?: Array<{ name?: string }> } | null | undefined,
  ): { settings: Record<string, unknown>; movedKeys: string[] } {
    const declared = new Set(
      (schema?.fields || []).map((field) => String(field?.name || '')).filter(Boolean),
    );
    if (!declared.size) {
      return { settings: storedSettings, movedKeys: [] };
    }

    const next: Record<string, unknown> = { ...storedSettings };
    const movedKeys: string[] = [];

    for (const [key, value] of Object.entries(storedSettings || {})) {
      if (!key.includes('_') || declared.has(key)) {
        continue;
      }
      const camelKey = PluginSettingsKeyMigrationService.toCamelCase(key);
      if (!declared.has(camelKey)) {
        continue;
      }
      // A value already stored under the declared name is the newer truth — never clobber it.
      const current = next[camelKey];
      if (current === undefined || current === null || current === '') {
        next[camelKey] = value;
      }
      // `undefined` rather than `delete`: settings.update() merges, and the merged object is
      // serialised with JSON.stringify, which omits undefined — so this actually removes the key.
      next[key] = undefined;
      movedKeys.push(`${key} -> ${camelKey}`);
    }

    return { settings: next, movedKeys };
  }
}

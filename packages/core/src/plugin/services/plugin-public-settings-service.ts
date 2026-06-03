import { SystemConstants } from '../../constants';
import { PluginConfigValueService } from './plugin-config-value-service';

/**
 * Resolves the subset of each active plugin's settings that may be published to the
 * public, unauthenticated storefront (`/api/v1/system/frontend` → `runtime.globalSettings`).
 *
 * Security model (fail-closed):
 *  - A field is published ONLY when it is explicitly flagged `public: true` in the schema.
 *  - Defence in depth: a `password`-typed field, or a field whose name matches a credential
 *    pattern, is NEVER published even if mis-flagged `public: true`.
 *  - Only whitelisted keys are emitted — the full settings object is never spread out.
 *
 * Values are resolved as `storedValue ?? defaultValue`, mirroring the per-plugin
 * `context.settings.get()` proxy, so the storefront sees the same effective config the
 * backend uses.
 */
export class PluginPublicSettingsService {
  // Separator-insensitive credential guard. Plugin field names are camelCase (`apiKey`,
  // `authToken`), while the persisted-settings guard uses snake_case; normalising the name
  // (strip non-alphanumerics, lowercase) before matching catches BOTH conventions so a
  // credential can never leak to the public storefront endpoint regardless of casing.
  private static readonly SENSITIVE_FIELD_RE =
    /secret|password|passphrase|credential|privatekey|apikey|accesstoken|authtoken|refreshtoken|bearertoken|token/i;

  static async resolve(
    activePlugins: Array<{ manifest?: { slug?: string; namespace?: string } }>,
    getSchema: (slug: string) => any,
    db: { findOne: (table: string, where: Record<string, any>) => Promise<any> },
  ): Promise<Record<string, Record<string, any>>> {
    const result: Record<string, Record<string, any>> = {};

    for (const plugin of activePlugins) {
      const slug = plugin?.manifest?.slug;
      if (!slug) continue;

      const schema = getSchema(slug);
      const fields = Array.isArray(schema?.fields) ? schema.fields : [];
      const publicFields = fields.filter((field: any) => PluginPublicSettingsService.isPublishable(field));
      if (publicFields.length === 0) continue;

      const stored = await db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: slug });
      const storedSettings = PluginConfigValueService.getSettings(stored?.settings);

      const published: Record<string, any> = {};
      for (const field of publicFields) {
        const value = storedSettings[field.name] !== undefined ? storedSettings[field.name] : field.defaultValue;
        if (value !== undefined) published[field.name] = value;
      }
      if (Object.keys(published).length === 0) continue;

      const namespace = plugin?.manifest?.namespace;
      if (namespace) result[`${namespace}/${slug}`] = published;
      result[slug] = published;
    }

    return result;
  }

  private static isPublishable(field: any): boolean {
    if (!field || field.public !== true) return false;
    if (field.type === 'password') return false;
    const normalizedName = String(field.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (PluginPublicSettingsService.SENSITIVE_FIELD_RE.test(normalizedName)) return false;
    return true;
  }
}

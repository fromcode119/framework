import { SystemConstants } from '@core/constants/system.constants';
import { SettingsContextProxy } from '@core/plugin/context/settings';
import { CoercionUtils } from '@core/utils/coercion-utils';
import type { IDatabaseManager } from '@fromcode119/database';

/**
 * The settings of a plugin's PLATFORM part (`_system_plugin_platform_settings`): one value per
 * installation, never per site. A plugin declares them with `context.platform.registerSettings` and reads
 * them with `context.platform.getSettings`; the console shows them only where no site is bound.
 *
 * Secret fields are stored sealed, by the same rule as a plugin's own settings: the console's form
 * encrypts them on save and {@link open} unseals them for the plugin.
 */
export class PluginPlatformSettings {
  private static readonly schemas = new Map<string, { fields: Array<Record<string, any>>; tabs?: unknown[] }>();

  /**
   * Declares `slug`'s platform settings. A name that repeats one of the plugin's own (site) settings is
   * refused: one form at a time shows both on an installation with no tenants, and a shared name would
   * save one value into the other.
   */
  static register(slug: string, schema: { fields: Array<Record<string, any>>; tabs?: unknown[] }, siteSchema?: { fields?: Array<Record<string, any>> }): void {
    const own = new Set((siteSchema?.fields ?? []).map((field) => String(field?.name)));
    const clash = (schema?.fields ?? []).find((field) => own.has(String(field?.name)));
    if (clash) throw new Error(`plugin "${slug}": platform setting "${clash.name}" repeats a site setting's name`);
    PluginPlatformSettings.schemas.set(slug, { fields: [...(schema?.fields ?? [])], tabs: schema?.tabs });
  }

  static schema(slug: string): { fields: Array<Record<string, any>>; tabs?: unknown[] } | undefined {
    return PluginPlatformSettings.schemas.get(slug);
  }

  static forget(slug: string): void {
    PluginPlatformSettings.schemas.delete(slug);
  }

  constructor(private readonly db: IDatabaseManager) {}

  /** As stored: secrets still sealed. For the console, which masks them. */
  async stored(slug: string): Promise<Record<string, any>> {
    const row = await this.db.findOne(SystemConstants.TABLE.PLUGIN_PLATFORM_SETTINGS, { plugin_slug: slug });
    return { ...CoercionUtils.toParsedObject(row?.settings) };
  }

  /** Defaults under the stored values, secrets opened. For the plugin's platform part. */
  async open(slug: string): Promise<Record<string, any>> {
    const schema = PluginPlatformSettings.schema(slug);
    const defaults: Record<string, any> = {};
    for (const field of schema?.fields ?? []) if (field.defaultValue !== undefined) defaults[field.name] = field.defaultValue;
    return SettingsContextProxy.openSecrets({ ...defaults, ...(await this.stored(slug)) }, schema);
  }

  /** Replaces the stored values; the caller has already sealed the secret fields. */
  async save(slug: string, settings: Record<string, any>): Promise<void> {
    const existing = await this.db.findOne(SystemConstants.TABLE.PLUGIN_PLATFORM_SETTINGS, { plugin_slug: slug });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.PLUGIN_PLATFORM_SETTINGS, { plugin_slug: slug }, { settings, updated_at: new Date() });
      return;
    }
    await this.db.insert(SystemConstants.TABLE.PLUGIN_PLATFORM_SETTINGS, { plugin_slug: slug, settings, updated_at: new Date() });
  }
}

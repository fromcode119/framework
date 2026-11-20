import type { IEmailCategory } from '@core/email/interfaces/email-category.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginConfigValueService } from '@core/plugin/services/settings/plugin-config-value-service';

/**
 * Which declared streams a site actually offers. A stream that names an `enabledBy` setting is offered only
 * while the declaring plugin's setting resolves to `true` on this site — the stored value, else the schema's
 * own `defaultValue`, the same value `context.settings.get()` gives the plugin that sends the mail.
 */
export class EmailCategoryAvailability {
  static async offered(
    categories: IEmailCategory[],
    getSchema: (slug: string) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
    db: { findOne: (table: string, where: Record<string, any>) => Promise<any> }, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<IEmailCategory[]> {
    const stored = new Map<string, Record<string, unknown>>();
    const offered: IEmailCategory[] = [];
    for (const category of categories) {
      if (!category.enabledBy) {
        offered.push(category);
        continue;
      }
      if (!stored.has(category.pluginSlug)) {
        const row = await db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: category.pluginSlug });
        stored.set(category.pluginSlug, PluginConfigValueService.getSettings(row?.settings));
      }
      const values = stored.get(category.pluginSlug) || {};
      const fields = getSchema(category.pluginSlug)?.fields;
      const field = (Array.isArray(fields) ? fields : []).find((entry: any) => entry?.name === category.enabledBy); // eslint-disable-line @typescript-eslint/no-explicit-any
      const value = values[category.enabledBy] !== undefined ? values[category.enabledBy] : field?.defaultValue;
      if (value === true || value === 'true') offered.push(category);
    }
    return offered;
  }
}

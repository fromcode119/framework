import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';
import { PluginConfigValueService } from '../services/plugin-config-value-service';


export class SettingsContextProxy {
  static createSettingsProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface
) {
      return {
        register: (schema: any) => {
          manager.registerPluginSettings(plugin.manifest.slug, schema);
        },
        get: async () => {
          const stored = await manager.db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: plugin.manifest.slug });
          const storedSettings = PluginConfigValueService.getSettings(stored?.settings);
          const schema = manager.getPluginSettings(plugin.manifest.slug);

          if (schema && schema.fields) {
            const defaults: Record<string, any> = {};
            schema.fields.forEach((field: any) => {
              if (field.defaultValue !== undefined) {
                defaults[field.name] = field.defaultValue;
              }
            });
            return { ...defaults, ...storedSettings };
          }
          return storedSettings;
        },
        update: async (values: Record<string, any>) => {
          const stored = await manager.db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: plugin.manifest.slug });
          const currentConfig = PluginConfigValueService.getConfig(stored?.settings);

          await manager.savePluginConfig(plugin.manifest.slug, {
            ...currentConfig,
            settings: values
          });

          manager.emit('plugin:settings:updated', {
            pluginSlug: plugin.manifest.slug,
            settings: values
          });
        }
      };

  }
}

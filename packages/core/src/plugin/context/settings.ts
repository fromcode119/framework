import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from './utils.interfaces';
import { SystemConstants } from '../../constants';
import { PluginConfigValueService } from '../services/plugin-config-value-service';
import { SecretService } from '../../security/secret-service';


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
          const existingSettings = PluginConfigValueService.getSettings(stored?.settings);

          const schema = manager.getPluginSettings(plugin.manifest.slug);
          const settingsToSave = { ...values };
          const SENSITIVE_FIELD_RE = /secret|password|api_key|private_key|access_token|auth_token|refresh_token|bearer_token|credential|passphrase/i;
          if (schema?.fields) {
            for (const field of schema.fields) {
              if (field.type !== 'password' && !SENSITIVE_FIELD_RE.test(String(field.name || ''))) continue;
              const incoming = settingsToSave[field.name];
              if (!incoming || SecretService.isSavedSecretMask(incoming)) {
                settingsToSave[field.name] = existingSettings[field.name] ?? '';
              } else if (!SecretService.isEncryptedValue(incoming)) {
                settingsToSave[field.name] = SecretService.encrypt(String(incoming));
              }
            }
          }

          await manager.savePluginConfig(plugin.manifest.slug, {
            ...currentConfig,
            settings: settingsToSave
          });

          manager.emit('plugin:settings:updated', {
            pluginSlug: plugin.manifest.slug,
            settings: settingsToSave
          });
        }
      };

  }
}

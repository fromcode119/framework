import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginConfigValueService } from '@core/plugin/services/plugin-config-value-service';
import { SecretService } from '@core/security/secret-service';
import { PluginSettingsKeyMigrationService } from '@core/plugin/services/plugin-settings-key-migration-service';

export class SettingsContextProxy {
  static createSettingsProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface
) {
      return {
        register: (schema: any) => {
          manager.registerPluginSettings(plugin.manifest.slug, schema);
        },
        get: async () => {
          const stored = await manager.db.findOne(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: plugin.manifest.slug });
          const rawSettings = PluginConfigValueService.getSettings(stored?.settings);
          const schema = manager.getPluginSettings(plugin.manifest.slug);

          // Resolve legacy (snake_case) stored keys onto the names the plugin declares today. Done
          // HERE, at read time, so the right value comes back on the very first get() — a plugin that
          // reads its settings during boot must not race a background cleanup write.
          const reconciled = PluginSettingsKeyMigrationService.reconcile(rawSettings, schema);
          const storedSettings = reconciled.settings;

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
          // Merge over existing settings — `update()` is a partial update by name. Replacing
          // the whole object here would silently wipe any key the caller didn't pass (e.g. a
          // periodic Finance/tax sync that only touches a few keys must not drop the rest).
          // The admin "save settings form" path uses savePluginConfig directly with the full
          // object, so clearing a field there is unaffected.
          const settingsToSave = { ...existingSettings, ...values };
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

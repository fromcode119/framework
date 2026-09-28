import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginConfigValueService } from '@core/plugin/services/settings/plugin-config-value-service';
import { SecretService } from '@core/security/secret-service';
import { PluginSettingsKeyMigrationService } from '@core/plugin/services/settings/plugin-settings-key-migration-service';

export class SettingsContextProxy {
  /**
   * The fields whose values are sealed at rest: every `password` field, and any field whose NAME says
   * it holds a credential. `update()` encrypts exactly these and `get()` opens exactly these, so the
   * two can never disagree about which values are ciphertext. The separator is optional because plugin
   * settings are camelCase (`accessToken`); a pattern that required `access_token` never matched one.
   */
  private static readonly SENSITIVE_FIELD_RE = /secret|password|api_?key|private_?key|access_?token|auth_?token|refresh_?token|bearer_?token|credential|passphrase/i;

  private static isSecretField(field: any): boolean {
    return field?.type === 'password' || SettingsContextProxy.SENSITIVE_FIELD_RE.test(String(field?.name || ''));
  }

  /**
   * Opens every sealed value, so a plugin reads the credential its operator typed.
   *
   * The admin settings form encrypts secret fields on save, and `get()` used to return them as stored:
   * every plugin reading a secret setting received `enc:v1:…` and used THAT as the credential — a
   * reCAPTCHA secret that never verified, a webhook signed with ciphertext. A value that cannot be
   * opened (no key on this server, or sealed under another one) comes back empty, never as ciphertext
   * the plugin would mistake for the secret.
   */
  private static openSecrets(settings: Record<string, any>, schema: any): Record<string, any> {
    if (!schema?.fields) return settings;
    const opened = { ...settings };
    for (const field of schema.fields) {
      if (!SettingsContextProxy.isSecretField(field) || !SecretService.isEncryptedValue(opened[field.name])) continue;
      try {
        opened[field.name] = SecretService.decrypt(opened[field.name]);
      } catch {
        opened[field.name] = '';
      }
    }
    return opened;
  }

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
            return SettingsContextProxy.openSecrets({ ...defaults, ...storedSettings }, schema);
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
          // periodic billing/tax sync that only touches a few keys must not drop the rest).
          // The admin "save settings form" path uses savePluginConfig directly with the full
          // object, so clearing a field there is unaffected.
          const settingsToSave = { ...existingSettings, ...values };
          if (schema?.fields) {
            for (const field of schema.fields) {
              if (!SettingsContextProxy.isSecretField(field)) continue;
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

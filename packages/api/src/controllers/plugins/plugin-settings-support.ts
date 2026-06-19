import { PluginManager, Logger, SecretService } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';

/**
 * Schema resolution, password/secret field handling, settings validation and
 * dynamic option sourcing for plugin settings. Extracted from
 * PluginSettingsController to keep each file under the size limit; the
 * controller instantiates this with the same PluginManager/Logger and
 * delegates, so behavior is unchanged.
 */
export class PluginSettingsSupport {
  private static readonly DYNAMIC_OPTIONS_SOURCE_SYSTEM_LOCALES = 'system_locales';

  private static readonly SENSITIVE_FIELD_RE = /secret|password|api_key|private_key|access_token|auth_token|refresh_token|bearer_token|credential|passphrase/i;

  constructor(private manager: PluginManager, private logger: Logger) {}

  private getPasswordFieldNames(fields: any[]): Set<string> {
    return new Set(
      fields
        .filter(f => f.type === 'password' || PluginSettingsSupport.SENSITIVE_FIELD_RE.test(String(f.name || '')))
        .map(f => f.name)
    );
  }

  maskPasswordFields(settings: Record<string, any>, fields: any[]): Record<string, any> {
    const passwordFields = this.getPasswordFieldNames(fields);
    const result = { ...settings };
    for (const key of passwordFields) {
      if (key in result) {
        result[key] = SecretService.maskIfPresent(result[key]);
      }
    }
    return result;
  }

  encryptPasswordFields(
    newSettings: Record<string, any>,
    existingSettings: Record<string, any>,
    fields: any[]
  ): Record<string, any> {
    const passwordFields = this.getPasswordFieldNames(fields);
    const result = { ...newSettings };
    for (const key of passwordFields) {
      const incoming = result[key];
      if (!incoming || SecretService.isSavedSecretMask(incoming)) {
        // Preserve existing encrypted value
        result[key] = existingSettings[key] ?? '';
      } else if (!SecretService.isEncryptedValue(incoming)) {
        result[key] = SecretService.encrypt(String(incoming));
      }
    }
    return result;
  }

  stripPasswordFields(settings: Record<string, any>, fields: any[]): Record<string, any> {
    const passwordFields = this.getPasswordFieldNames(fields);
    const result = { ...settings };
    for (const key of passwordFields) {
      result[key] = '';
    }
    return result;
  }

  getDefaults(fields: any[]): Record<string, any> {
    const defaults: Record<string, any> = {};
    fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    return defaults;
  }

  async validateSettings(
    settings: Record<string, any>,
    schema: any
  ): Promise<Record<string, string> | null> {
    const errors: Record<string, string> = {};
    const fields = schema.fields || [];

    for (const field of fields) {
      const value = settings[field.name];

      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.name] = 'This field is required';
        continue;
      }

      if (value === undefined || value === null || value === '') {
        continue;
      }

      switch (field.type) {
        case 'number':
          if (typeof value !== 'number' || Number.isNaN(value)) {
            errors[field.name] = 'Must be a number';
          } else if (field.min !== undefined && value < field.min) {
            errors[field.name] = `Must be at least ${field.min}`;
          } else if (field.max !== undefined && value > field.max) {
            errors[field.name] = `Must be at most ${field.max}`;
          }
          break;
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors[field.name] = 'Must be a valid email';
          }
          break;
        case 'url':
          try {
            new URL(String(value));
          } catch {
            errors[field.name] = 'Must be a valid URL';
          }
          break;
        case 'select':
          if (Array.isArray(field.options)) {
            const optionValues = new Set(field.options.map((option: any) => option?.value));
            const isMultiple = field?.admin?.multiple === true;
            if (isMultiple) {
              if (!Array.isArray(value) || value.some((entry) => !optionValues.has(entry))) {
                errors[field.name] = 'Must be a valid option';
              }
            } else if (!optionValues.has(value)) {
              errors[field.name] = 'Must be a valid option';
            }
          }
          break;
        default:
          break;
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  async getEffectiveSchema(slug: string): Promise<any | null> {
    const settingsRegistry = this.manager.getPluginSettings(slug);
    if (!settingsRegistry) {
      return null;
    }

    const schema = { ...settingsRegistry };
    schema.fields = await this.resolveDynamicOptions(schema.fields || []);
    return schema;
  }

  private async resolveDynamicOptions(fields: any[]): Promise<any[]> {
    const resolvedFields: any[] = [];

    for (const field of fields) {
      if (field?.dynamicOptionsSource === PluginSettingsSupport.DYNAMIC_OPTIONS_SOURCE_SYSTEM_LOCALES) {
        const localeOptions = await this.buildSystemLocaleOptions();
        resolvedFields.push({
          ...field,
          options: localeOptions,
        });
        continue;
      }

      resolvedFields.push(field);
    }

    return resolvedFields;
  }

  private async buildSystemLocaleOptions(): Promise<Array<{ label: string; value: string }>> {
    try {
      const locales = await (this.manager as any).db.settings.findFirst({
        where: (settings: any, operators: any) => operators.eq(settings.key, SystemConstants.META_KEY.LOCALIZATION_LOCALES),
      });

      const rawValue = locales?.value;
      if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        return [];
      }

      const parsed = JSON.parse(rawValue);
      const localeList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.locales)
          ? parsed.locales
          : [];

      return localeList
        .map((locale: any) => {
          const code = String(locale?.code || '').trim();
          if (!code) {
            return null;
          }

          const label = String(locale?.label || locale?.name || code).trim() || code;
          return { label, value: code };
        })
        .filter((option: { label: string; value: string } | null): option is { label: string; value: string } => option !== null);
    } catch (error: any) {
      this.logger.warn(`Failed to resolve system locale options: ${error?.message || 'unknown error'}`);
      return [];
    }
  }
}

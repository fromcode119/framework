import { IntegrationFieldType } from '@/app/settings/integrations/enums/integration-field-type.enum';
export class IntegrationsPageUtils {
  /**
   * Hydrates the wire-string `type` on every provider field of the given integration records.
   *
   * Provider definitions are authored server-side with `type` as a plain string, while everything
   * downstream compares it against an {@link IntegrationFieldType} member with `===`. A record that
   * skips this step keeps raw strings, every comparison silently answers false, and the editor
   * degrades to plain text inputs — a password field then renders its saved-secret mask in the
   * clear and a boolean renders the string "false".
   *
   * Call it at EVERY fetch boundary that produces integration records, reads and writes alike.
   */
  static hydrateFieldTypes<T>(integrations: T[]): T[] {
    for (const integration of (integrations || []) as any[]) {
      for (const provider of integration?.providers || []) {
        for (const field of provider?.fields || []) {
          field.type = IntegrationFieldType.resolve(field.type);
        }
      }
    }
    return integrations;
  }

  static normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }

  static readConfigFieldValue(fieldName: string, config: Record<string, any> = {}): any {
    if (Object.prototype.hasOwnProperty.call(config || {}, fieldName)) {
      return config?.[fieldName];
    }

    const authConfig = config?.auth;
    if (
      (fieldName === 'user' || fieldName === 'pass')
      && authConfig
      && Object.prototype.hasOwnProperty.call(authConfig, fieldName)
    ) {
      return authConfig?.[fieldName];
    }

    return undefined;
  }

  static isBlank(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  }

  static copyConfigWithoutSavedSecrets(
    fields: Array<{ name: string; type: IntegrationFieldType }> = [],
    config: Record<string, any> = {},
  ): Record<string, any> {
    const nextConfig: Record<string, any> = {};
    for (const field of fields) {
      const value = IntegrationsPageUtils.readConfigFieldValue(field.name, config);
      if (value === undefined) {
        continue;
      }

      nextConfig[field.name] = value;
      if (field.type === IntegrationFieldType.PASSWORD && String(nextConfig[field.name] || '').trim()) {
        nextConfig[field.name] = '';
      }
    }
    return nextConfig;
  }

  static readPreservedSecretFields(
    fields: Array<{ name: string; type: IntegrationFieldType }> = [],
    config: Record<string, any> = {},
  ): Record<string, boolean> {
    const preserved: Record<string, boolean> = {};
    for (const field of fields) {
      if (field.type === IntegrationFieldType.PASSWORD) {
        preserved[field.name] = String(IntegrationsPageUtils.readConfigFieldValue(field.name, config) || '').trim().length > 0;
      }
    }
    return preserved;
  }

  static resolveFieldAutocomplete(field: { name: string; label?: string; type: IntegrationFieldType; placeholder?: string }): string {
    const fieldText = IntegrationsPageUtils.normalizeKey(
      `${field.name} ${field.label || ''} ${field.placeholder || ''}`,
    );

    if (field.type === IntegrationFieldType.PASSWORD) {
      return 'current-password';
    }

    if (/(secret|token|key|password|pass|credential|client_id|client_secret)/.test(fieldText)) {
      return 'off';
    }

    if (/(user|username|email|login|account)/.test(fieldText)) {
      return 'username';
    }

    return 'off';
  }

  static copyConfigForFields(
    fields: Array<{ name: string }> = [],
    config: Record<string, any> = {},
  ): Record<string, any> {
    const nextConfig: Record<string, any> = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(config || {}, field.name)) {
        nextConfig[field.name] = config[field.name];
      }
    }
    return nextConfig;
  }
}

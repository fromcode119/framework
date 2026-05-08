export class IntegrationsPageUtils {
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
    fields: Array<{ name: string; type: string }> = [],
    config: Record<string, any> = {},
  ): Record<string, any> {
    const nextConfig: Record<string, any> = {};
    for (const field of fields) {
      const value = IntegrationsPageUtils.readConfigFieldValue(field.name, config);
      if (value === undefined) {
        continue;
      }

      nextConfig[field.name] = value;
      if (field.type === 'password' && String(nextConfig[field.name] || '').trim()) {
        nextConfig[field.name] = '';
      }
    }
    return nextConfig;
  }

  static readPreservedSecretFields(
    fields: Array<{ name: string; type: string }> = [],
    config: Record<string, any> = {},
  ): Record<string, boolean> {
    const preserved: Record<string, boolean> = {};
    for (const field of fields) {
      if (field.type === 'password') {
        preserved[field.name] = String(IntegrationsPageUtils.readConfigFieldValue(field.name, config) || '').trim().length > 0;
      }
    }
    return preserved;
  }

  static resolveFieldAutocomplete(field: { name: string; label?: string; type: string; placeholder?: string }): string {
    const fieldText = IntegrationsPageUtils.normalizeKey(
      `${field.name} ${field.label || ''} ${field.placeholder || ''}`,
    );

    if (field.type === 'password') {
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

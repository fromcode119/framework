export class PluginConfigValueService {
  static getConfig(value: any): Record<string, any> {
    const parsed = PluginConfigValueService.parseValue(value);
    return PluginConfigValueService.isPlainObject(parsed) ? parsed : {};
  }

  static getSettings(value: any): Record<string, any> {
    const config = PluginConfigValueService.getConfig(value);
    const parsedSettings = PluginConfigValueService.parseValue(config.settings);
    return PluginConfigValueService.isPlainObject(parsedSettings) ? parsedSettings : {};
  }

  private static parseValue(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return {};
    }

    try {
      return JSON.parse(normalizedValue);
    } catch {
      return value;
    }
  }

  private static isPlainObject(value: any): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

import type { PluginHealthBuildOptions, PluginHealthIdentity, PluginHealthResponse } from './plugin-health-response.interfaces';

export class PluginHealthResponseBuilder {
  /**
   * Builds the default plugin health payload shared by plugin API endpoints.
   *
   * @example
   * const payload = PluginHealthResponseBuilder.build({ slug: 'forms', version: '1.0.0' });
   */
  static build(plugin: PluginHealthIdentity, options: PluginHealthBuildOptions = {}): PluginHealthResponse {
    const response: PluginHealthResponse = {
      status: options.status || 'ok',
      plugin: String(plugin.slug || '').trim(),
      version: String(plugin.version || '').trim(),
      timestamp: options.timestamp || new Date().toISOString(),
    };

    if (options.message) {
      response.message = String(options.message).trim();
    }

    if (options.details) {
      response.details = options.details;
    }

    return response;
  }
}
import { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';
import type { IPluginHealthBuildOptions } from '@core/interfaces/plugin-health-build-options.interface';
import type { IPluginHealthIdentity } from '@core/interfaces/plugin-health-identity.interface';
import type { IPluginHealthResponse } from '@core/interfaces/plugin-health-response.interface';

export class PluginHealthResponseBuilder {
  /**
   * Builds the default plugin health payload shared by plugin API endpoints.
   *
   * @example
   * const payload = PluginHealthResponseBuilder.build({ slug: 'forms', version: '1.0.0' });
   */
  static build(plugin: IPluginHealthIdentity, options: IPluginHealthBuildOptions = {}): IPluginHealthResponse {
    const response: IPluginHealthResponse = {
      // Plugins are compiled separately and hand us a RAW status string, so hydrate at this boundary —
      // otherwise the payload mixes enum members (the default) with plain strings (caller-supplied).
      // `Enum.toJSON()` emits the bare value, so the wire shape is unchanged either way.
      status: PluginHealthStatus.resolve(options.status),
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
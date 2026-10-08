import type { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';

export interface IPluginHealthBuildOptions {
  /**
   * A plugin is compiled apart from the framework and answers its probe with a plain value
   * (`'ok'`, `'degraded'`, `'error'`); `PluginHealthResponseBuilder` hydrates it with `resolve()`.
   * Typed `Enum | string`, as the other fields a plugin writes as literals are.
   */
  status?: PluginHealthStatus | string;
  timestamp?: string;
  message?: string;
  details?: Record<string, unknown>;
}

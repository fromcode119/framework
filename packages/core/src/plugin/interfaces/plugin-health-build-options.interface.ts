import type { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';

export interface IPluginHealthBuildOptions {
  status?: PluginHealthStatus;
  timestamp?: string;
  message?: string;
  details?: Record<string, unknown>;
}

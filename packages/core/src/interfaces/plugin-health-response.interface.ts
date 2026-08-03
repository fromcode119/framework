import type { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';

export interface IPluginHealthResponse {
  status: PluginHealthStatus;
  plugin: string;
  version: string;
  timestamp: string;
  message?: string;
  details?: Record<string, unknown>;
}

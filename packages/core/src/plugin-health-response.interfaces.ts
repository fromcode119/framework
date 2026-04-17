import type { PluginHealthStatus } from './plugin-health-response.types';

export interface PluginHealthIdentity {
  slug: string;
  version: string;
}

export interface PluginHealthResponse {
  status: PluginHealthStatus;
  plugin: string;
  version: string;
  timestamp: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface PluginHealthBuildOptions {
  status?: PluginHealthStatus;
  timestamp?: string;
  message?: string;
  details?: Record<string, unknown>;
}
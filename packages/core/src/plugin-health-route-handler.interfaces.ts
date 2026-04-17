import type { PluginHealthBuildOptions, PluginHealthIdentity } from './plugin-health-response.interfaces';

export interface PluginHealthProbeResult extends PluginHealthBuildOptions {
  httpStatus?: number;
}

export interface PluginHealthRouteHandlerOptions {
  getPlugin: () => PluginHealthIdentity | Promise<PluginHealthIdentity>;
  probe?: () => PluginHealthProbeResult | Promise<PluginHealthProbeResult>;
}
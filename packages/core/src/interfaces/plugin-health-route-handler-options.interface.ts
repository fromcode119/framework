import type { IPluginHealthIdentity } from '@core/interfaces/plugin-health-identity.interface';
import type { IPluginHealthProbeResult } from '@core/interfaces/plugin-health-probe-result.interface';

export interface IPluginHealthRouteHandlerOptions {
  getPlugin: () => IPluginHealthIdentity | Promise<IPluginHealthIdentity>;
  probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>;
}

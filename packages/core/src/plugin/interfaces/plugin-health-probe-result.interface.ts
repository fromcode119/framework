import { IPluginHealthBuildOptions } from '@core/plugin/interfaces/plugin-health-build-options.interface';

export interface IPluginHealthProbeResult extends IPluginHealthBuildOptions {
  httpStatus?: number;
}

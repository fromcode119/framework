import { IPluginHealthBuildOptions } from '@core/interfaces/plugin-health-build-options.interface';

export interface IPluginHealthProbeResult extends IPluginHealthBuildOptions {
  httpStatus?: number;
}

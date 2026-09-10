import { IPluginHealthRouteHandlerOptions } from '@core/plugin/interfaces/plugin-health-route-handler-options.interface';

export interface IBasePluginRouterOptions extends IPluginHealthRouteHandlerOptions {
  registerStatus?: boolean;
}
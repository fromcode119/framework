import { IPluginHealthRouteHandlerOptions } from '@core/interfaces/plugin-health-route-handler-options.interface';

export interface IBasePluginRouterOptions extends IPluginHealthRouteHandlerOptions {
  registerStatus?: boolean;
}
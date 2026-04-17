import type { PluginHealthRouteHandlerOptions } from '../plugin-health-route-handler.interfaces';

export interface BasePluginRouterOptions extends PluginHealthRouteHandlerOptions {
  registerStatus?: boolean;
}
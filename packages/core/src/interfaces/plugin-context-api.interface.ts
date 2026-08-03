import type { IMiddlewareConfig } from '@core/interfaces/middleware-config.interface';
import type { IPluginHealthProbeResult } from '@core/interfaces/plugin-health-probe-result.interface';

/**
 * The `context.api` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextApi {
  get(path: string, ...handlers: any[]): void;
  health(probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>): void;
  post(path: string, ...handlers: any[]): void;
  put(path: string, ...handlers: any[]): void;
  delete(path: string, ...handlers: any[]): void;
  patch(path: string, ...handlers: any[]): void;
  status(probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>): void;
  use(path: string, ...handlers: any[]): void;
  registerMiddleware(config: IMiddlewareConfig): void;
}

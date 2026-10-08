import type { RequestHandler } from 'express';
import type { IApiAccessDescriptor } from '@core/plugin/context/interfaces/api-access-descriptor.interface';
import type { IMiddlewareConfig } from '@core/interfaces/middleware-config.interface';
import type { IPluginHealthProbeResult } from '@core/plugin/interfaces/plugin-health-probe-result.interface';

/**
 * The `context.api` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 *
 * A route takes an optional leading `{ access }` descriptor, then Express handlers. Typed, not `any[]`:
 * with `any[]` an inline `(req, res) => …` handler had no types at all, and nothing said so.
 */
export interface IPluginContextApi {
  get(path: string, ...handlers: Array<IApiAccessDescriptor | RequestHandler>): void;
  health(probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>): void;
  post(path: string, ...handlers: Array<IApiAccessDescriptor | RequestHandler>): void;
  put(path: string, ...handlers: Array<IApiAccessDescriptor | RequestHandler>): void;
  delete(path: string, ...handlers: Array<IApiAccessDescriptor | RequestHandler>): void;
  patch(path: string, ...handlers: Array<IApiAccessDescriptor | RequestHandler>): void;
  status(probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>): void;
  use(path: string, ...handlers: RequestHandler[]): void;
  registerMiddleware(config: IMiddlewareConfig): void;
}

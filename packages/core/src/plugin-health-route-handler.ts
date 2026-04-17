import type { RequestHandler } from 'express';
import { PluginHealthResponseBuilder } from './plugin-health-response';
import type { PluginHealthIdentity } from './plugin-health-response.interfaces';
import type { PluginHealthProbeResult, PluginHealthRouteHandlerOptions } from './plugin-health-route-handler.interfaces';

export class PluginHealthRouteHandler {
  static createForPlugin(plugin: PluginHealthIdentity, probe?: () => PluginHealthProbeResult | Promise<PluginHealthProbeResult>): RequestHandler {
    return this.create({ getPlugin: () => plugin, probe });
  }

  static create(options: PluginHealthRouteHandlerOptions): RequestHandler {
    return async (_req, res, next) => {
      try {
        const plugin = await options.getPlugin();
        const probe = options.probe ? await options.probe() : null;
        const response = PluginHealthResponseBuilder.build(plugin, probe || undefined);
        res.status(this.resolveHttpStatus(probe)).json(response);
      } catch (error) {
        next(error);
      }
    };
  }

  private static resolveHttpStatus(probe: PluginHealthProbeResult | null): number {
    if (typeof probe?.httpStatus === 'number' && probe.httpStatus >= 100) {
      return probe.httpStatus;
    }

    if (probe?.status === 'error') {
      return 503;
    }

    return 200;
  }
}
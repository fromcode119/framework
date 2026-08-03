import { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';
import type { RequestHandler } from 'express';
import { PluginHealthResponseBuilder } from '@core/plugin-health-response-builder';
import type { IPluginHealthIdentity } from '@core/interfaces/plugin-health-identity.interface';
import type { IPluginHealthProbeResult } from '@core/interfaces/plugin-health-probe-result.interface';
import type { IPluginHealthRouteHandlerOptions } from '@core/interfaces/plugin-health-route-handler-options.interface';

export class PluginHealthRouteHandler {
  static createForPlugin(plugin: IPluginHealthIdentity, probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>): RequestHandler {
    return this.create({ getPlugin: () => plugin, probe });
  }

  static create(options: IPluginHealthRouteHandlerOptions): RequestHandler {
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

  private static resolveHttpStatus(probe: IPluginHealthProbeResult | null): number {
    if (typeof probe?.httpStatus === 'number' && probe.httpStatus >= 100) {
      return probe.httpStatus;
    }

    if (PluginHealthStatus.resolve(probe?.status) === PluginHealthStatus.ERROR) {
      return 503;
    }

    return 200;
  }
}
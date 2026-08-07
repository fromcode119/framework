import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IMiddlewareConfig } from '@core/interfaces/middleware-config.interface';
import { Logger } from '@core/logging';
import { PluginHealthRouteHandler } from '@core/plugin-health-route-handler';
import { RouteConstants } from '@core/constants/route.constants';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginHealthProbeResult } from '@core/interfaces/plugin-health-probe-result.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';
import { RateLimiter } from '@core/security/rate-limiter';
import { ApiAccessGate } from '@core/plugin/context/api-access-gate';
import { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import type { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { AsyncRouteGuard } from '@core/base/async-route-guard';

export class ApiContextProxy {
  private static readonly apiLimiter = new RateLimiter(1000, 60000);
  private static readonly reservedPaths = ['config', 'settings', 'toggle', 'logs', 'sandbox', 'active', 'marketplace', 'install', 'upload'];

  static createApiProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface,
  pluginLogger: Logger,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation, handleRateLimit } = security;

      const createApiWrapper = (method: string) => (path: string, ...handlers: any[]) => {
        if (!hasCapability('api')) {
          handleViolation('api');
        }

        // A route may DECLARE its access as a leading `{ access }` descriptor. The central fail-closed
        // gate (ApiAccessGate) enforces it when ENFORCE_AUTHZ_GATEWAY=true; undeclared => admin-only.
        // `use` (raw middleware) is exempt — it is not a terminal route.
        let access: AccessLevel | ApiPermissionRequirement | undefined;
        if (method !== 'use' && ApiAccessGate.isDescriptor(handlers[0])) {
          access = handlers[0].access;
          handlers = handlers.slice(1);
        }

        if (!ApiContextProxy.apiLimiter.check(plugin.manifest.slug)) {
          handleRateLimit('API Registration');
        }

        if (path.includes('..')) {
          throw new Error(`Security Violation: Plugin "${plugin.manifest.slug}" attempted invalid API path: ${path}`);
        }

        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const firstSegment = cleanPath.split('/')[0];

        if (ApiContextProxy.reservedPaths.includes(firstSegment)) {
          throw new Error(`Conflict: Plugin "${plugin.manifest.slug}" attempted to register a reserved system path: /${firstSegment}.`);
        }

        const fullPath = `/${plugin.manifest.slug}/${cleanPath}`;

        if (!manager.apiHost) {
          pluginLogger.debug(`Registered ${method.toUpperCase()} ${fullPath} (MOCK)`);
          return;
        }

        // A plugin that hands over a whole express Router (`context.api.use('/', router.router)` — the
        // repo convention) cannot be protected by the try/catch below: the Router returns synchronously
        // and Express invokes its layers itself, so a rejection inside a layer is never observed and
        // kills the process. Wrap the layers themselves. Handlers already guarded by BaseRouter are
        // marked and skipped, so this never double-wraps.
        handlers.forEach(handler => AsyncRouteGuard.wrapRouter(handler, plugin.manifest.slug));

        const wrappedHandlers = handlers.map(handler => async (req: any, res: any, next: any) => {
          try {
            const currentPlugin = manager.plugins.get(plugin.manifest.slug);
            if (!currentPlugin || currentPlugin.state !== PluginState.ACTIVE) {
              return res.status(403).json({
                error: `Plugin "${plugin.manifest.slug}" is disabled`,
                code: 'PLUGIN_DISABLED'
              });
            }
            await handler(req, res, next);
          } catch (error) {
            next(error);
          }
        });

        const gate = method === 'use' ? null : ApiAccessGate.build(access);
        manager.apiHost[method](fullPath, ...(gate ? [gate, ...wrappedHandlers] : wrappedHandlers));
      };

      return {
        get: createApiWrapper('get'),
        health: (probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>) => {
          createApiWrapper('get')(
            RouteConstants.SEGMENTS.HEALTH,
            { access: AccessLevel.PUBLIC },
            PluginHealthRouteHandler.createForPlugin(plugin.manifest, probe),
          );
        },
        post: createApiWrapper('post'),
        put: createApiWrapper('put'),
        delete: createApiWrapper('delete'),
        patch: createApiWrapper('patch'),
        status: (probe?: () => IPluginHealthProbeResult | Promise<IPluginHealthProbeResult>) => {
          createApiWrapper('get')(
            RouteConstants.SEGMENTS.STATUS,
            { access: AccessLevel.PUBLIC },
            PluginHealthRouteHandler.createForPlugin(plugin.manifest, probe),
          );
        },
        use: createApiWrapper('use'),
        registerMiddleware: (config: IMiddlewareConfig) => {
          if (!hasCapability('api')) {
            handleViolation('api');
          }

          const originalHandler = config.handler;
          config.handler = (req: any, res: any, next: any) => {
            const currentPlugin = manager.plugins.get(plugin.manifest.slug);
            if (!currentPlugin || currentPlugin.state !== PluginState.ACTIVE) {
              return next();
            }
            return originalHandler(req, res, next);
          };

          config.pluginSlug = plugin.manifest.slug;
          manager.middlewares.register(config);
          pluginLogger.debug(`Registered global middleware: ${config.id} (${config.stage})`);
        }
      };

  }
}
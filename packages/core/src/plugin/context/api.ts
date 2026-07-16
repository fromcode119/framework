import { LoadedPlugin, MiddlewareConfig } from '../../types';
import { Logger } from '../../logging';
import { PluginHealthRouteHandler } from '../../plugin-health-route-handler';
import { RouteConstants } from '../../route-constants';
import type { PluginManagerInterface } from './utils.interfaces';
import type { PluginHealthProbeResult } from '../../plugin-health-route-handler.interfaces';
import { ContextSecurityProxy } from './utils';
import { RateLimiter } from '../../security/rate-limiter';
import { ApiAccessGate } from './api-access-gate';
import { AccessLevel } from './api-access-gate.enums';
import type { ApiAccessLevel } from './api-access-gate.types';
import { PluginState } from '../services/plugin-state.enums';

const apiLimiter = new RateLimiter(1000, 60000);
const reservedPaths = ['config', 'settings', 'toggle', 'logs', 'sandbox', 'active', 'marketplace', 'install', 'upload'];

export class ApiContextProxy {
  static createApiProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
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
        let access: ApiAccessLevel | undefined;
        if (method !== 'use' && ApiAccessGate.isDescriptor(handlers[0])) {
          access = handlers[0].access;
          handlers = handlers.slice(1);
        }

        if (!apiLimiter.check(plugin.manifest.slug)) {
          handleRateLimit('API Registration');
        }

        if (path.includes('..')) {
          throw new Error(`Security Violation: Plugin "${plugin.manifest.slug}" attempted invalid API path: ${path}`);
        }

        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const firstSegment = cleanPath.split('/')[0];

        if (reservedPaths.includes(firstSegment)) {
          throw new Error(`Conflict: Plugin "${plugin.manifest.slug}" attempted to register a reserved system path: /${firstSegment}.`);
        }

        const fullPath = `/${plugin.manifest.slug}/${cleanPath}`;

        if (!manager.apiHost) {
          pluginLogger.debug(`Registered ${method.toUpperCase()} ${fullPath} (MOCK)`);
          return;
        }

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
        health: (probe?: () => PluginHealthProbeResult | Promise<PluginHealthProbeResult>) => {
          createApiWrapper('get')(
            RouteConstants.SEGMENTS.HEALTH,
            { access: AccessLevel.Public },
            PluginHealthRouteHandler.createForPlugin(plugin.manifest, probe),
          );
        },
        post: createApiWrapper('post'),
        put: createApiWrapper('put'),
        delete: createApiWrapper('delete'),
        patch: createApiWrapper('patch'),
        status: (probe?: () => PluginHealthProbeResult | Promise<PluginHealthProbeResult>) => {
          createApiWrapper('get')(
            RouteConstants.SEGMENTS.STATUS,
            { access: AccessLevel.Public },
            PluginHealthRouteHandler.createForPlugin(plugin.manifest, probe),
          );
        },
        use: createApiWrapper('use'),
        registerMiddleware: (config: MiddlewareConfig) => {
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
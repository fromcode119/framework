import { LoadedPlugin, MiddlewareConfig } from '../../types';
import { Logger } from '@fromcode119/sdk';
import { PluginManagerInterface, createSecurityHelpers } from './utils';
import { RateLimiter } from '../../security/rate-limiter';

const apiLimiter = new RateLimiter(1000, 60000);
const reservedPaths = ['config', 'settings', 'toggle', 'logs', 'sandbox', 'active', 'marketplace', 'install', 'upload'];

export function createApiProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  pluginLogger: Logger,
  security: ReturnType<typeof createSecurityHelpers>
) {
  const { hasCapability, handleViolation, handleRateLimit } = security;

  const createApiWrapper = (method: string) => (path: string, ...handlers: any[]) => {
    if (!hasCapability('api')) {
      handleViolation('api');
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

    const wrappedHandlers = handlers.map(handler => (req: any, res: any, next: any) => {
      const currentPlugin = manager.plugins.get(plugin.manifest.slug);
      if (!currentPlugin || currentPlugin.state !== 'active') {
        return res.status(403).json({
          error: `Plugin "${plugin.manifest.slug}" is disabled`,
          code: 'PLUGIN_DISABLED'
        });
      }
      return handler(req, res, next);
    });

    manager.apiHost[method](fullPath, ...wrappedHandlers);
  };

  return {
    get: createApiWrapper('get'),
    post: createApiWrapper('post'),
    put: createApiWrapper('put'),
    delete: createApiWrapper('delete'),
    patch: createApiWrapper('patch'),
    use: createApiWrapper('use'),
    registerMiddleware: (config: MiddlewareConfig) => {
      if (!hasCapability('api')) {
        handleViolation('api');
      }

      const originalHandler = config.handler;
      config.handler = (req: any, res: any, next: any) => {
        const currentPlugin = manager.plugins.get(plugin.manifest.slug);
        if (!currentPlugin || currentPlugin.state !== 'active') {
          return next();
        }
        return originalHandler(req, res, next);
      };

      manager.middlewares.register(config);
      pluginLogger.debug(`Registered global middleware: ${config.id} (${config.stage})`);
    }
  };
}

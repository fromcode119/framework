import type { Request, Response, NextFunction } from 'express';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginGuestHandlers } from '@core/plugin/host/plugin-guest-handlers';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginHealthRouteHandler } from '@core/plugin/plugin-health-route-handler';
import { RouteConstants } from '@core/constants/route.constants';
import { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import { ApiAccessGate } from '@core/plugin/context/api-access-gate';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { IPluginContextApi } from '@core/interfaces/plugin-context-api.interface';
import type { IMiddlewareConfig } from '@core/interfaces/middleware-config.interface';

/**
 * `context.api` inside a guest: every route is mounted on the guest's own Express under the same
 * `/<slug>/<path>` the host uses, and the host is told the method + path (+ access descriptor) so it
 * can register a forwarding route that proxies to the guest's socket. Handlers never cross.
 *
 * The host keeps the platform gates in front of the forward (plugin active, enabled for the tenant,
 * access level) exactly as for in-process plugins.
 */
export class PluginGuestApiFactory {
  private static readonly reservedPaths = ['config', 'settings', 'toggle', 'logs', 'sandbox', 'active', 'marketplace', 'install', 'upload'];

  constructor(
    private readonly channel: PluginChannel,
    private readonly handlers: PluginGuestHandlers,
    private readonly http: PluginGuestHttp,
    private readonly boot: IPluginGuestBoot,
  ) {}

  create(): IPluginContextApi {
    const verb = (method: string) => (path: string, ...handlers: any[]) => this.mount(method, path, handlers);
    return {
      get: verb('get'),
      post: verb('post'),
      put: verb('put'),
      delete: verb('delete'),
      patch: verb('patch'),
      use: verb('use'),
      health: (probe) => this.mount('get', RouteConstants.SEGMENTS.HEALTH, [{ access: AccessLevel.PUBLIC }, PluginHealthRouteHandler.createForPlugin(this.boot.manifest as any, probe)]),
      status: (probe) => this.mount('get', RouteConstants.SEGMENTS.STATUS, [{ access: AccessLevel.PUBLIC }, PluginHealthRouteHandler.createForPlugin(this.boot.manifest as any, probe)]),
      registerMiddleware: (config: IMiddlewareConfig) => this.middleware(config),
    };
  }

  private mount(method: string, path: string, handlers: any[]): void {
    let access: unknown;
    if (method !== 'use' && ApiAccessGate.isDescriptor(handlers[0])) {
      access = PluginGuestApiFactory.portableAccess(handlers[0].access);
      handlers = handlers.slice(1);
    }
    if (path.includes('..')) throw new Error(`Security Violation: Plugin "${this.boot.slug}" attempted invalid API path: ${path}`);
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const first = cleanPath.split('/')[0];
    if (PluginGuestApiFactory.reservedPaths.includes(first)) {
      throw new Error(`Conflict: Plugin "${this.boot.slug}" attempted to register a reserved system path: /${first}.`);
    }
    const fullPath = `/${this.boot.slug}/${cleanPath}`;
    (this.http.app as any)[method](fullPath, ...handlers);
    const registration: IPluginGuestRegistration = { kind: method === 'use' ? 'use' : 'route', method, path: fullPath, access };
    void this.channel.request('register', registration, 30_000);
  }

  private middleware(config: IMiddlewareConfig): void {
    const id = this.handlers.keep('middleware', config.handler as (...args: any[]) => unknown);
    this.http.mountMiddleware(id, (req: Request, res: Response, next: NextFunction) => config.handler(req, res, next));
    void this.channel.request('register', {
      kind: 'middleware',
      handlerId: id,
      middleware: { id: config.id, priority: config.priority, stage: String((config.stage as any)?.value ?? config.stage) },
    } satisfies IPluginGuestRegistration, 30_000);
  }

  /** An `AccessLevel` crosses as its value; a permission requirement as its plain shape. */
  private static portableAccess(access: unknown): unknown {
    if (access instanceof AccessLevel) return { level: access.value };
    if (access && typeof access === 'object') return { requirement: JSON.parse(JSON.stringify(access)) };
    return undefined;
  }
}

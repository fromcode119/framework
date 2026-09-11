import type { Request, Response, NextFunction } from 'express';
import { RequestContextUtils } from '@core/context/request-context';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { CoreServices } from '@core/services/core-services';
import { McpRegistryProvider } from '@core/mcp/mcp-registry-provider';
import { MiddlewareStage } from '@core/enums/middleware-stage.enum';
import { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import type { PluginContext } from '@core/plugin/plugin-context';

/**
 * The host's stand-ins for what the guest registered: each one is registered on the REAL context
 * (so every platform gate — active, enabled for the tenant, access level, capability, rate limit —
 * still applies) and, when it fires, hands the work to the guest under a fresh invocation token.
 *
 * Routes are forwarded over HTTP to the guest's socket by path; everything else is a message.
 * Registrations survive a guest restart: a route is registered on Express once and forwards to
 * whichever guest process is current; hook/middleware stand-ins are dropped and re-registered when
 * the restarted guest runs `onInit` again.
 */
export class PluginHostRegistrations {
  private readonly routes = new Set<string>();
  private readonly hooks = new Map<string, { event: string; handler: (...args: any[]) => unknown }>();
  private readonly platformHooks = new Map<string, { event: string; handler: (...args: any[]) => unknown }>();
  private jobWorkerRegistered = false;

  constructor(
    private readonly slug: string,
    private readonly proxy: PluginHostHttpProxy,
    private readonly invoke: (kind: string, handlerId: string, args: unknown[], store: IRequestStore | undefined) => Promise<unknown>,
    private readonly forwardRequest: (req: Request, res: Response, next: NextFunction, targetPath?: string, originalUrl?: string) => Promise<void>,
    private readonly db: { withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> },
  ) {}

  /**
   * Applies one registration. Most answer nothing; `tenants-for-each` answers a count, which the
   * host returns to the guest so `context.tenants.forEach` can report how many sites it ran for.
   */
  apply(context: PluginContext, registration: IPluginGuestRegistration): void | Promise<number> {
    switch (registration.kind) {
      case 'route': return this.route(context, registration);
      case 'use': return this.use(context, registration);
      case 'middleware': return this.middleware(context, registration);
      case 'hook': return this.hook(context, registration);
      case 'hook-off': return this.hookOff(context, registration);
      case 'plugins-on': return this.pluginsOn(context, registration);
      case 'scheduler': return this.scheduler(context, registration);
      case 'tenants-for-each': return this.tenantsForEach(registration);
      case 'job-worker': return this.jobWorker(context, registration);
      case 'mcp-tools': return this.mcpTools(context, registration);
      case 'gate': return this.gate(registration);
      case 'canonical-path': return this.canonicalPath(registration);
      default: throw new Error(`unknown registration kind "${(registration as any).kind}"`);
    }
  }

  /** Before a restarted guest re-runs onInit: forget the function stand-ins it will register again. */
  resetForRestart(context: PluginContext): void {
    for (const { event, handler } of this.hooks.values()) context.hooks.off(event, handler as any);
    this.hooks.clear();
    for (const { event, handler } of this.platformHooks.values()) (context.plugins as any).off?.(event, handler);
    this.platformHooks.clear();
    // The context's `mcp` proxy clears the plugin's tools only on the FIRST registration of its
    // lifetime — right for the in-process disable/enable cycle it was written for, wrong for a guest
    // that is relaunched under the SAME context: its second boot re-registered every tool and the
    // registry refused with "already registered", so a restarted ecommerce or finance lost its MCP
    // tools until the api restarted. The host owns the guest's registrations, so it clears them here.
    McpRegistryProvider.get().unregisterOwner(this.slug);
  }

  private relativePath(fullPath: string): string {
    const prefix = `/${this.slug}/`;
    return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath.replace(/^\//, '');
  }

  private route(context: PluginContext, registration: IPluginGuestRegistration): void {
    const method = String(registration.method || 'get');
    const key = `${method} ${registration.path}`;
    if (this.routes.has(key)) return;
    this.routes.add(key);
    const handlers: unknown[] = [];
    const access = PluginHostRegistrations.reviveAccess(registration.access);
    if (access) handlers.push({ access });
    handlers.push((req: Request, res: Response, next: NextFunction) => this.forwardRequest(req, res, next));
    (context.api as any)[method](this.relativePath(String(registration.path)), ...handlers);
  }

  private use(context: PluginContext, registration: IPluginGuestRegistration): void {
    const key = `use ${registration.path}`;
    if (this.routes.has(key)) return;
    this.routes.add(key);
    context.api.use(this.relativePath(String(registration.path)), (req: Request, res: Response, next: NextFunction) => this.forwardRequest(req, res, next));
  }

  private middleware(context: PluginContext, registration: IPluginGuestRegistration): void {
    const config = registration.middleware;
    if (!config || !registration.handlerId) return;
    const target = `${PluginGuestHttp.MIDDLEWARE_PATH}/${encodeURIComponent(registration.handlerId)}`;
    context.api.registerMiddleware({
      id: config.id,
      priority: config.priority,
      stage: MiddlewareStage.resolve(config.stage),
      handler: (req: Request, res: Response, next: NextFunction) => { void this.forwardRequest(req, res, next, target, req.originalUrl); },
    });
  }

  private hook(context: PluginContext, registration: IPluginGuestRegistration): void {
    const id = String(registration.handlerId);
    const event = String(registration.event);
    const handler = (payload: unknown, ev: string) => this.invoke('hook', id, [payload, ev], RequestContextUtils.storage.getStore());
    this.hooks.set(id, { event, handler });
    context.hooks.on(event, handler as any);
  }

  /** `context.plugins.on(event, handler)`: the manager's own bus, no tenant gate — exactly what in-process plugins get. */
  private pluginsOn(context: PluginContext, registration: IPluginGuestRegistration): void {
    const id = String(registration.handlerId);
    const event = String(registration.event);
    const handler = (payload: unknown, ev: string) => this.invoke('hook', id, [payload, ev], RequestContextUtils.storage.getStore());
    this.platformHooks.set(id, { event, handler });
    context.plugins.on(event, handler as any);
  }

  /**
   * `context.tenants.forEach` for an ISOLATED plugin.
   *
   * The loop runs on the HOST: entering a site's scope means binding a database connection, and the
   * guest has none of its own. Each turn invokes the guest's handler with the store this run is in,
   * so the work the guest does lands in the right site — the same forwarding a scheduled task uses.
   */
  private async tenantsForEach(registration: IPluginGuestRegistration): Promise<number> {
    const id = String(registration.handlerId);
    return PerTenantRun.forEach({
      label: `guest:${id}:tenants.forEach`,
      db: this.db as never,
      work: async () => { await this.invoke('tenants', id, [], RequestContextUtils.storage.getStore()); },
    });
  }

  private hookOff(context: PluginContext, registration: IPluginGuestRegistration): void {
    const entry = this.hooks.get(String(registration.handlerId));
    if (!entry) return;
    context.hooks.off(entry.event, entry.handler as any);
    this.hooks.delete(String(registration.handlerId));
  }

  private scheduler(context: PluginContext, registration: IPluginGuestRegistration): void {
    const id = String(registration.handlerId);
    // The store is read WHEN THE TASK FIRES, not here. `PluginScheduledTenantRun` wraps this stub and
    // runs it once per tenant inside that tenant's context; passing `undefined` threw that away, so an
    // ISOLATED plugin's guest ran untenanted and every db call it made was skipped-and-warned. The task
    // looked like it ran — "ran for 5 of 9 tenant(s)" — and read nothing for any of them.
    void context.scheduler.register(String(registration.name), String(registration.schedule), async (data: unknown) => {
      await this.invoke('scheduler', id, [data], RequestContextUtils.storage.getStore());
    }, (registration.options ?? {}) as any);
  }

  private jobWorker(context: PluginContext, registration: IPluginGuestRegistration): void {
    if (this.jobWorkerRegistered) return;
    this.jobWorkerRegistered = true;
    const id = String(registration.handlerId);
    // Same reason as the scheduler above: whatever tenant context the job runs under must reach the guest.
    (context.jobs as any).worker((job: any) => this.invoke('job', id, [{ id: job?.id, name: job?.name, data: job?.data }], RequestContextUtils.storage.getStore()), registration.options);
  }

  private mcpTools(context: PluginContext, registration: IPluginGuestRegistration): void {
    const tools = (registration.tools ?? []).map((tool) => {
      const { handlerId, ...definition } = tool;
      return { ...definition, handler: (...args: unknown[]) => this.invoke('mcp-tool', String(handlerId), args, RequestContextUtils.storage.getStore()) };
    });
    context.mcp.registerTools(tools as any);
  }

  private gate(registration: IPluginGuestRegistration): void {
    const id = String(registration.handlerId);
    CoreServices.getInstance().contentResolutionGates.register(String(registration.key), ((...args: unknown[]) =>
      this.invoke('gate', id, args, RequestContextUtils.storage.getStore())) as any);
  }

  private canonicalPath(registration: IPluginGuestRegistration): void {
    const id = String(registration.handlerId);
    CoreServices.getInstance().canonicalPathResolvers.register(String(registration.key), ((...args: unknown[]) =>
      this.invoke('canonical-path', id, args, RequestContextUtils.storage.getStore())) as any);
  }

  private static reviveAccess(access: unknown): AccessLevel | ApiPermissionRequirement | undefined {
    if (!access || typeof access !== 'object') return undefined;
    const shape = access as { level?: string; requirement?: { permission?: string } };
    if (shape.level) return (AccessLevel.fromValue(shape.level) as AccessLevel | undefined) ?? undefined;
    if (shape.requirement?.permission) return new ApiPermissionRequirement(String(shape.requirement.permission));
    return undefined;
  }
}

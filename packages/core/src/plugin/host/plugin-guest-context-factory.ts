import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginGuestHandlers } from '@core/plugin/host/plugin-guest-handlers';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';
import { PluginGuestPeerNamespace } from '@core/plugin/host/plugin-guest-peer-namespace';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginGuestSql } from '@core/plugin/host/plugin-guest-sql';
import { PluginGuestState } from '@core/plugin/host/plugin-guest-state';
import { PluginGuestApiFactory } from '@core/plugin/host/plugin-guest-api-factory';
import { PluginGuestLocals } from '@core/plugin/host/plugin-guest-locals';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { PluginContext } from '@core/plugin/plugin-context';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginGuestRegistrar } from '@core/plugin/host/registrations/plugin-guest-registrar';
import { PluginGuestDeclarations } from '@core/plugin/host/declarations/plugin-guest-declarations';
import { PluginChannelMessage } from '@core/plugin/host/enums/plugin-channel-message.enum';

/**
 * The `PluginContext` an isolated plugin receives: the same shape as in-process, every namespace an
 * RPC stand-in. Data namespaces are remote chains (`context.settings.get(k)` → one message). The six
 * places where the plugin hands the framework a FUNCTION keep it here under an id and register a
 * forwarding stand-in on the host. Guards are local functions; routes go through the guest's Express.
 */
export class PluginGuestContextFactory {
  /** The synchronous-answering locals `create()` built — `PluginGuest` awaits `locals.flush()` after
   *  each lifecycle hook so a forwarded i18n registration lands at the host before the plugin is
   *  reported active. Null until `create()` runs. */
  locals: PluginGuestLocals | null = null;

  constructor(
    private readonly channel: PluginChannel,
    private readonly registrar: PluginGuestRegistrar,
    private readonly remote: PluginGuestRemote,
    private readonly handlers: PluginGuestHandlers,
    private readonly http: PluginGuestHttp,
    private readonly state: PluginGuestState,
    private readonly boot: IPluginGuestBoot,
  ) {}

  create(): PluginContext {
    const remote = this.remote;
    const register = (payload: IPluginGuestRegistration) => this.registrar.send(payload);
    const declarations = new PluginGuestDeclarations(register, (handler) => this.handlers.keepStable(handler));
    const ctx = (name: string) => declarations.namespace(name, remote.ref('context', [{ name }]));
    const locals = new PluginGuestLocals(this.boot, this.remote, declarations);
    this.locals = locals;
    const context: Record<string, unknown> = {
      db: this.database([{ name: 'db' }]),
      api: new PluginGuestApiFactory(this.registrar, this.handlers, this.http, this.boot).create(),
      hooks: this.hooks(register),
      auth: this.auth(),
      logger: this.logger(),
      plugin: { ...this.boot.plugin },
      plugins: this.plugins(register),
      dependencies: { require: (key: string) => this.dependency(key, true), optional: (key: string) => this.dependency(key, false) },
      scheduler: this.scheduler(register),
      // Work that belongs to every site. The handler stays in the guest and the HOST drives the loop,
      // entering each site's scope before invoking it — the guest has no database connection of its
      // own to bind, so it cannot do this itself. Same mechanism as a scheduled task.
      tenants: {
        forEach: (work: () => Promise<void>) =>
          register({ kind: String(PluginGuestRegistrationKind.TENANTS_FOR_EACH.value), handlerId: this.handlers.keep('tenants', work) }) as Promise<number>,
        current: () => remote.call('context', [{ name: 'tenants' }, { name: 'current', args: [] }]),
        isMultiSite: () => remote.call('context', [{ name: 'tenants' }, { name: 'isMultiSite', args: [] }]),
        // Forwarded like the two above, and it has to be: an isolated plugin has no tenant resolver
        // and no database connection of its own, so the HOST is the only side that can answer which
        // host this site is reached on. Omitting it did not degrade — it threw `is not a function` the
        // first time a guest asked, which is how a plugin that mails a link found out.
        baseUrls: () => remote.call('context', [{ name: 'tenants' }, { name: 'baseUrls', args: [] }]),
      },
      jobs: {
        add: (name: string, data: unknown, options?: unknown) => remote.call('context', [{ name: 'jobs' }, { name: 'add', args: PluginGuestRemote.portable([name, data, options]) }]),
        worker: (processor: (...args: any[]) => unknown, options?: Record<string, unknown>) => register({ kind: String(PluginGuestRegistrationKind.JOB_WORKER.value), handlerId: this.handlers.keep('job', processor), options: options ?? {} }),
      },
      mcp: { registerTools: (tools: Array<Record<string, any>>) => this.registerTools(tools, register) },
      migrations: { run: (migrations: unknown) => this.runMigrations(migrations) },
      fetch: (url: string, init?: Record<string, unknown>) => this.fetch(url, init),
      t: locals.t,
      i18n: locals.i18n,
      paths: locals.paths,
    };
    for (const name of ['collections', 'settings', 'meta', 'signing', 'users', 'people', 'roles', 'notifications', 'email', 'media', 'recordVersions',
      'entityRecords', 'entities', 'theme', 'ui', 'integrations', 'storage', 'cache', 'redis', 'extensions']) {
      context[name] = ctx(name);
    }
    return context as unknown as PluginContext;
  }

  /** `db` with `sql`/`eq`/`and`/`or` local (they build query objects) and SQL objects flattened for the wire. */
  private database(base: Array<{ name: string; args?: unknown[] }>): unknown {
    const remote = this.remote;
    const database = this;
    return new Proxy({}, {
      get(_target, prop) {
        // Loaded on first use, not at boot: drizzle is ~100 modules and ~10 MB, and most plugins never
        // build a query object here. Every plugin process paid for it anyway.
        if (prop === 'sql' || prop === 'eq' || prop === 'and' || prop === 'or') return (require('drizzle-orm') as typeof import('drizzle-orm'))[prop];
        if (prop === 'stored') return database.database([...base, { name: 'stored' }]);
        if (typeof prop !== 'string') return undefined;
        return (...args: unknown[]) => remote.call('context', [...base, { name: prop, args: PluginGuestSql.portableArgs(PluginGuestRemote.portable(args)) }]);
      },
    });
  }

  private hooks(register: (p: IPluginGuestRegistration) => Promise<unknown>): Record<string, unknown> {
    const remote = this.remote;
    const handlers = this.handlers;
    return {
      on: (event: string, handler: (...args: any[]) => unknown) => { void register({ kind: String(PluginGuestRegistrationKind.HOOK.value), event, handlerId: handlers.keep('hook', handler) }); },
      off: (event: string, handler: unknown) => {
        const id = handlers.idOf(handler);
        if (id) { handlers.forget(id); void register({ kind: String(PluginGuestRegistrationKind.HOOK_OFF.value), event, handlerId: id }); }
      },
      emit: (event: string, payload: unknown) => { void remote.call('context', [{ name: 'hooks' }, { name: 'emit', args: PluginGuestRemote.portable([event, payload]) }]); },
      call: (event: string, payload: unknown) => remote.call('context', [{ name: 'hooks' }, { name: 'call', args: PluginGuestRemote.portable([event, payload]) }]),
    };
  }

  private auth(): unknown {
    const remote = this.remote;
    const http = this.http;
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'guard') return (roles: string[] = []) => PluginGuestHttp.guard(roles);
        if (prop === 'platformGuard') return () => PluginGuestHttp.platformGuard();
        if (prop === 'requirePermission') return (permission: string | string[]) => http.requirePermission(permission);
        if (prop === 'isAuthenticated') return (request: any) => !!request?.user;
        if (typeof prop !== 'string') return undefined;
        return (...args: unknown[]) => remote.call('context', [{ name: 'auth' }, { name: prop, args: PluginGuestRemote.portable(args) }]);
      },
    });
  }

  private logger(): Record<string, unknown> {
    const channel = this.channel;
    const line = (level: string) => (msg: unknown, ...meta: unknown[]) => PluginGuestRemote.channelFor(channel).notify(String(PluginChannelMessage.LOG.value), { level, msg: String(msg), meta: PluginGuestRemote.portable(meta) });
    return { info: line('info'), warn: line('warn'), error: line('error'), debug: line('debug') };
  }

  private plugins(register: (p: IPluginGuestRegistration) => Promise<unknown>): Record<string, unknown> {
    const remote = this.remote;
    const state = this.state;
    // The guest's own logger, which the host prints under this plugin's name.
    const debug = (message: string) => { (this.logger() as any).debug(message); };
    return {
      namespace: (namespace: string) => PluginGuestPeerNamespace.build(namespace, state, remote, debug),
      has: (namespace: string, slug: string) => state.hasPeer(namespace, slug),
      get: (namespace: string, slug: string) => (state.hasPeer(namespace, slug) ? remote.ref('context', [{ name: 'plugins' }, { name: 'get', args: [namespace, slug] }]) : null),
      require: (key: string) => this.dependency(key, true),
      optional: (key: string) => this.dependency(key, false),
      isEnabled: (slug: string) => state.isEnabled(slug),
      emit: (event: string, payload: unknown) => { void remote.call('context', [{ name: 'plugins' }, { name: 'emit', args: PluginGuestRemote.portable([event, payload]) }]); },
      // `context.plugins.on` is the PLATFORM bus (`plugins:ready` fires with no tenant), not the tenant-gated
      // `context.hooks.on`: routed through the gate, an isolated plugin never heard plugins:ready at all.
      on: (event: string, handler: (...args: any[]) => unknown) => { void register({ kind: String(PluginGuestRegistrationKind.PLUGINS_ON.value), event, handlerId: this.handlers.keep('hook', handler) }); },
    };
  }

  private dependency(key: string, required: boolean): unknown {
    const index = key.indexOf(':');
    const namespace = index >= 0 ? key.slice(0, index).trim() : '';
    const slug = index >= 0 ? key.slice(index + 1).trim() : '';
    if (!namespace || !slug) throw new Error(`Invalid dependency key "${key}". Expected "namespace:slug".`);
    if (!this.state.hasPeer(namespace, slug)) {
      if (required) throw new Error(`Missing required dependency: ${key}`);
      return null;
    }
    return this.remote.ref('context', [{ name: 'plugins' }, { name: 'get', args: [namespace, slug] }]);
  }

  private scheduler(register: (p: IPluginGuestRegistration) => Promise<unknown>): Record<string, unknown> {
    const remote = this.remote;
    return {
      register: (name: string, schedule: string, handler: (...args: any[]) => unknown, options: Record<string, unknown> = {}) =>
        register({ kind: String(PluginGuestRegistrationKind.SCHEDULER.value), name, schedule, options: PluginGuestRemote.portable([options])[0] as Record<string, unknown>, handlerId: this.handlers.keep('scheduler', handler) }),
      runNow: (name: string) => remote.call('context', [{ name: 'scheduler' }, { name: 'runNow', args: [name] }]),
      schedule: (name: string, when: unknown, data: unknown) => remote.call('context', [{ name: 'scheduler' }, { name: 'schedule', args: PluginGuestRemote.portable([name, when, data]) }]),
    };
  }

  private registerTools(tools: Array<Record<string, any>>, register: (p: IPluginGuestRegistration) => Promise<unknown>): Promise<unknown> {
    const list = (Array.isArray(tools) ? tools : []).map((tool) => {
      const { handler, ...definition } = tool;
      return { ...(PluginGuestRemote.portable([definition])[0] as Record<string, unknown>), handlerId: this.handlers.keep('mcp-tool', handler) };
    });
    return register({ kind: String(PluginGuestRegistrationKind.MCP_TOOLS.value), tools: list });
  }

  /** Migrations run HERE (they are code) against a DDL stand-in whose statements the host executes on the owner connection. */
  private async runMigrations(migrations: unknown): Promise<void> {
    const list = (Array.isArray(migrations) ? migrations : [migrations]) as Array<{ up: (db: unknown) => Promise<void> }>;
    const ddl = this.database([]);
    // `dialect` is a VALUE, not a method. Read through the call-forwarding proxy it came back as a
    // function, so every `if (db.dialect !== 'postgres') return` guard exited — silently skipping each
    // Postgres-only step of every isolated plugin's migrations. Asked of the host once (a step with no
    // args reads the property) and handed over as the string it is.
    const dialect = await this.remote.call('ddl', [{ name: 'dialect' }]);
    for (const migration of list) {
      await migration.up(new Proxy(ddl as object, {
        get: (target, prop) => {
          if (prop === 'dialect') return dialect;
          return typeof prop === 'string' && !['sql', 'eq', 'and', 'or'].includes(prop)
            ? (...args: unknown[]) => this.remote.call('ddl', [{ name: prop, args: PluginGuestSql.portableArgs(PluginGuestRemote.portable(args)) }])
            : (target as any)[prop];
        },
      }));
    }
  }

  /** `context.fetch` is the platform's audited HTTP client; the host performs it and the body comes back as bytes. */
  private async fetch(url: string, init?: Record<string, unknown>): Promise<Response> {
    const safeInit = init ? { ...init } : undefined;
    if (safeInit && safeInit.body !== undefined && typeof safeInit.body !== 'string' && !Buffer.isBuffer(safeInit.body)) safeInit.body = JSON.stringify(safeInit.body);
    const reply = (await this.remote.call('context', [{ name: 'fetch', args: [url, safeInit] }])) as { status: number; statusText: string; headers: Record<string, string>; body: Buffer };
    return new Response(new Uint8Array(reply.body), { status: reply.status, statusText: reply.statusText, headers: reply.headers });
  }
}

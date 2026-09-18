import fs from 'fs';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import path from 'path';
import { TenantConnectionScope } from '@fromcode119/database';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginGuest } from '@core/plugin/host/plugin-guest';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginSchemaDatabaseProxy } from '@core/plugin/context/plugin-schema-database-proxy';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IPluginGuestBoot } from '@core/plugin/host/interfaces/plugin-guest-boot.interface';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { IPluginInvocation } from '@core/plugin/host/interfaces/plugin-invocation.interface';
import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { PluginContext } from '@core/plugin/plugin-context';
import { PluginHostGuestBridge } from '@core/plugin/host/plugin-host-guest-bridge';
import { PluginHostState } from '@core/plugin/host/plugin-host-state';
import { GuestOutputStream } from '@core/process/enums/guest-output-stream.enum';
import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';

/**
 * One isolated plugin, from the host's side: its process, its channel, its tokens, its stand-ins.
 *
 * The process is started with an EMPTY environment and a heap ceiling — as its own OS user when the
 * deployment has a privileged spawner (T5c) — and learns everything from the `boot` message. Every piece of work handed to it is one invocation with one token; every call it
 * makes back is dispatched under that token's tenant. A guest that dies is restarted with backoff and
 * re-initialised; after three deaths the plugin is disabled with the reason, and nothing else on the
 * platform notices either way.
 */
export class PluginHost extends PluginHostGuestBridge {
  /** The guest's Express server, inside the directory only the host and that guest can reach. */
  /** Mirrors `PluginManager.PLUGINS_READY_EVENT`; re-emitted when this guest is replaced. */


  constructor(
    slug: string,
    pluginDir: string,
    entryPath: string,
    manifest: Record<string, unknown>,
    manager: IPluginManagerInterface,
    settings: PluginIsolationSettings,
    projectRoot: string,
    /** The OS user the guest runs as when a privileged spawner exists; ignored by the fork launcher. */
    identity: IGuestIdentity | null = null,
  ) {
    super();
    this.slug = slug;
    this.pluginDir = pluginDir;
    this.entryPath = entryPath;
    this.manifest = manifest;
    this.manager = manager;
    this.projectRoot = projectRoot;
    this.identity = identity;
    // EVERY declared field is assigned here, `null`/`false`/`0` included — see PluginHostState.
    this.logger = new Logger({ namespace: `plugin-host:${slug}` });
    this.tokens = new PluginInvocationTokens();
    this.socketPath = ''; this.guest = null; this.channel = null; this.context = null;
    this.describeResult = null; this.restarts = 0; this.stopping = false; this.restarting = false;
    this.healthyTimer = null; this.wasEnabled = false; this.initDeferred = false;
    this.settings = settings;
    this.limits = settings.forPlugin(manifest.sandbox);
    this.proxy = new PluginHostHttpProxy('');
    this.callbacks = new PluginHostCallbacks(slug, (handlerId, args, store) => this.invoke({ kind: String(PluginInvocationKind.CALLBACK.value), handlerId, args }, store));
    const plugin = { manifest } as unknown as ILoadedPlugin;
    const ddl = PluginSchemaDatabaseProxy.create(plugin, manager);
    this.dispatcher = new PluginHostDispatcher(slug, this.tokens, manager.db, ddl, this.callbacks);
    this.registrations = new PluginHostRegistrations(
      slug,
      this.proxy,
      (kind, handlerId, args, store) => this.invoke({ kind: kind as IPluginInvocation['kind'], handlerId, args }, store),
      (req, res, next, targetPath, originalUrl) => this.forwardRequest(req, res, next, targetPath, originalUrl),
      // The RAW manager db: entering a site's scope binds a connection, and only this one can.
      manager.db,
    );
  }

  get limitsInEffect(): { memoryMb: number; timeoutMs: number } {
    return this.limits;
  }

  get pid(): number | null {
    return this.guest?.pid ?? null;
  }

  /**
   * The guest's entry file — always core's BUILT output.
   *
   * A guest is a plain `node` process spawned as another user with an empty environment: it can run
   * neither TypeScript nor the host's loader. In production `__dirname` is already `dist/plugin/host`
   * and the sibling `.js` is right there. Under the api's `tsx watch` dev server core is loaded from
   * `src`, where only `plugin-guest-main.ts` exists — node exited (1) on every plugin before it could
   * connect — so fall back to the same file under `dist`.
   */
  private static guestMainPath(): string {
    const sibling = path.join(__dirname, 'plugin-guest-main.js');
    if (fs.existsSync(sibling)) return sibling;
    return path.resolve(__dirname, '..', '..', '..', 'dist', 'plugin', 'host', 'plugin-guest-main.js');
  }

  /** Forks the guest, boots it, and learns which lifecycle hooks and public-API functions it has. */
  async start(): Promise<{ contractKeys: string[]; publicApiKeys: string[]; manifest: unknown }> {
    if (this.channel && !this.channel.isClosed && this.describeResult) return this.describeResult;
    this.stopping = false;
    const launcher = GuestProcessLaunchers.current();
    const guest = await launcher.launch({
      id: `plugin-${this.slug}`,
      entryPath: PluginHost.guestMainPath(),
      args: [],
      cwd: this.projectRoot,
      execArgv: [`--max-old-space-size=${this.limits.memoryMb}`],
      identity: this.identity,
      writableDirs: [path.join(this.projectRoot, 'data', 'plugins', this.slug)],
    });
    this.guest = guest;
    this.socketPath = path.join(guest.socketDir, PluginHostState.ROUTES_SOCKET);
    this.proxy.retarget(this.socketPath);
    guest.onOutput((stream, line) => (stream === GuestOutputStream.STDERR ? this.logger.warn(line) : this.logger.info(line)));
    this.channel = new PluginChannel(guest.port);
    this.channel.serve((type, payload) => this.serve(type, payload));
    this.channel.onNotify((type, payload) => this.notified(type, payload));
    // Only the CURRENT guest's exit means anything; one we already replaced was killed on purpose.
    guest.onExit((code, signal) => { if (this.guest === guest) this.exited(code, signal); });

    const boot: IPluginGuestBoot = {
      slug: this.slug,
      pluginDir: this.pluginDir,
      entryPath: this.entryPath,
      manifest: this.manifest,
      socketPath: this.socketPath,
      socketMode: guest.socketMode,
      projectRoot: this.projectRoot,
      defaultLocale: String(this.manager.i18n?.getDefaultLocale?.() ?? 'en'),
      plugin: {
        slug: this.slug,
        namespace: String(this.manifest.namespace || '').trim(),
        version: String(this.manifest.version || ''),
        dataDir: `./data/plugins/${this.slug}`,
        rootDir: this.pluginDir,
        config: (this.manifest.config as Record<string, unknown>) || {},
      },
    };
    const described = await this.channel.request<{ contractKeys: string[]; publicApiKeys: string[]; manifest: unknown }>('boot', boot, PluginHostState.BOOT_TIMEOUT_MS);
    this.describeResult = described;
    const who = launcher.isolatesIdentity && this.identity ? `, uid ${this.identity.uid}` : '';
    this.logger.info(`isolated process ${guest.pid} up (heap ${this.limits.memoryMb} MB, deadline ${this.limits.timeoutMs} ms${who})`);
    // A guest that stays up for a minute has earned its restart budget back: three failures in a
    // lifetime is a broken plugin, three failures a week apart is not.
    if (this.healthyTimer) clearTimeout(this.healthyTimer);
    this.healthyTimer = setTimeout(() => { this.restarts = 0; }, PluginHostState.HEALTHY_AFTER_MS);
    this.healthyTimer.unref();
    return described;
  }

  /**
   * The `ILoadedPlugin` functions: each forwards to the guest, binding the real context first.
   *
   * Every lifecycle key is offered (the guest answers `undefined` for one it does not have), because
   * an inactive plugin's guest is not running yet and cannot be asked. `onInit` on a plugin whose
   * guest is not started is DEFERRED: it runs when `onEnable` brings the guest up.
   */
  stubs(): Record<string, unknown> {
    const stubs: Record<string, unknown> = {};
    for (const key of PluginHost.LIFECYCLE_KEYS) {
      stubs[key] = async (ctx: PluginContext, ...extra: unknown[]) => {
        this.bindContext(ctx);
        if (!this.isRunning) {
          if (key === 'onInit') { this.initDeferred = true; return undefined; }
          if (key === 'onDisable' || key === 'onUninstall') return undefined;
          await this.start();
          if (this.initDeferred) { this.initDeferred = false; await this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: 'onInit' }, RequestContextUtils.storage.getStore()); }
        }
        if (key === 'onEnable') this.wasEnabled = true;
        if (key === 'onDisable') this.wasEnabled = false;
        // The store the host is in, NOT undefined. `publicAPI` has always forwarded it; lifecycle
        // never did, so an isolated plugin's onInit ran untenanted even when the caller had entered a
        // site's scope — which is exactly what the per-site replay does. Every write the guest made
        // was refused, and the plugin was told nothing.
        return this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: key, args: extra }, RequestContextUtils.storage.getStore());
      };
    }
    stubs.publicAPI = this.lazyPublicApi();
    // Carried so the resolver can tell "this peer is DOWN" from "this peer is broken" — see
    // `ILoadedPlugin.isRunning` for why it must survive the registry's spread as a function.
    stubs.isRunning = () => this.isRunning;
    return stubs;
  }

  private static readonly LIFECYCLE_KEYS = ['onInstall', 'onInit', 'onUpdate', 'onEnable', 'onDisable', 'onUninstall'] as const;

  get isRunning(): boolean {
    return !!this.channel && !this.channel.isClosed && !!this.describeResult;
  }

  /** Another plugin's `context.plugins.namespace(...).<slug>.fn()`: the keys are known once the guest has described itself. */
  private lazyPublicApi(): Record<string, unknown> {
    const host = this;
    return new Proxy({}, {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        if (!host.describeResult?.publicApiKeys.includes(prop)) return undefined;
        return (...args: unknown[]) => host.invoke({ kind: String(PluginInvocationKind.PUBLIC_API.value), name: prop, args }, RequestContextUtils.storage.getStore());
      },
      ownKeys() { return host.describeResult?.publicApiKeys ?? []; },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop === 'string' && host.describeResult?.publicApiKeys.includes(prop)) return { enumerable: true, configurable: true, value: undefined };
        return undefined;
      },
    });
  }

  bindContext(ctx: PluginContext): void {
    this.context = ctx;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.channel && !this.channel.isClosed) {
      await this.channel.request('stop', {}, 5_000).catch(() => undefined);
    }
    this.guest?.kill('SIGKILL');
    this.guest = null;
    // Close the channel NOW rather than on the child's exit event: a lifecycle stub that runs in the
    // same tick (delete → disable) must see `isRunning === false`, not a channel about to disconnect.
    this.channel?.close();
    this.channel = null;
    this.describeResult = null;
    this.tokens.revokeAll();
  }

  protected async invoke(work: Partial<IPluginInvocation> & { kind: IPluginInvocation['kind'] }, store: IRequestStore | undefined): Promise<unknown> {
    if (!this.channel || this.channel.isClosed) throw new Error(`plugin "${this.slug}" is not running`);
    const token = this.tokens.mint(work.kind, store);
    try {
      const invocation: IPluginInvocation = {
        kind: work.kind,
        handlerId: work.handlerId,
        name: work.name,
        args: work.args ?? [],
        token,
        tenantId: String(store?.tenantId ?? '').trim() || null,
        locale: String(store?.locale ?? ''),
        peers: this.peers(store),
        enabledPlugins: this.enabledPlugins(store),
      };
      // About to wait on another process: hand the request's database connection back first. Held
      // through the wait, ten such waits emptied the pool and the guest's own calls then queued behind
      // them — a deadlock until the deadline. The next statement on this side takes a fresh one.
      await TenantConnectionScope.releaseCurrent();
      const result = await this.channel.request('invoke', invocation, work.kind === String(PluginInvocationKind.LIFECYCLE.value) ? PluginHostState.BOOT_TIMEOUT_MS : this.limits.timeoutMs);
      return this.callbacks.revive(result);
    } finally {
      this.tokens.revoke(token);
    }
  }

  private async forwardRequest(req: Request, res: Response, next: NextFunction, targetPath?: string, originalUrl?: string): Promise<void> {
    const store = RequestContextUtils.storage.getStore();
    const token = this.tokens.mint('route', store);
    try {
      // Express strips a `use('/slug/')` mount from `req.url` (`/health`, not `/slug/health`); the guest
      // mounted the same full path the host did, so forward everything from the plugin segment on.
      const target = targetPath ?? PluginHost.pluginPath(this.slug, `${req.baseUrl || ''}${req.url || ''}`) ?? req.url;
      // Same reason as in `invoke`: the guest serves this request for as long as it likes; the api's
      // connection must not sit idle in the meantime.
      await TenantConnectionScope.releaseCurrent();
      await this.proxy.forward(req, res, next, { token, tenantId: String(store?.tenantId ?? '').trim() || null, locale: String(store?.locale ?? ''), targetPath: target, originalUrl }, this.limits.timeoutMs, () => this.restart('a request exceeded the deadline'));
    } finally {
      this.tokens.revoke(token);
    }
  }

  /** `/api/v1/plugins/<slug>/health?x=1` → `/<slug>/health?x=1`; null when the slug is not in the path. */
  static pluginPath(slug: string, fullPath: string): string | null {
    const marker = `/${slug}`;
    const index = fullPath.indexOf(marker);
    if (index < 0) return null;
    const rest = fullPath.slice(index + marker.length);
    if (rest !== '' && !rest.startsWith('/') && !rest.startsWith('?')) return null;
    return marker + (rest === '' ? '/' : rest);
  }

}
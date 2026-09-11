import fs from 'fs';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import path from 'path';
import { TenantConnectionScope } from '@fromcode119/database';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
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

/**
 * One isolated plugin, from the host's side: its process, its channel, its tokens, its stand-ins.
 *
 * The process is started with an EMPTY environment and a heap ceiling — as its own OS user when the
 * deployment has a privileged spawner (T5c) — and learns everything from the `boot` message. Every piece of work handed to it is one invocation with one token; every call it
 * makes back is dispatched under that token's tenant. A guest that dies is restarted with backoff and
 * re-initialised; after three deaths the plugin is disabled with the reason, and nothing else on the
 * platform notices either way.
 */
export class PluginHost {
  private static readonly MAX_RESTARTS = 3;
  private static readonly BOOT_TIMEOUT_MS = 60_000;
  private static readonly HEALTHY_AFTER_MS = 60_000;
  /** The guest's Express server, inside the directory only the host and that guest can reach. */
  static readonly ROUTES_SOCKET = 'routes.sock';
  /** Mirrors `PluginManager.PLUGINS_READY_EVENT`; re-emitted when this guest is replaced. */
  static readonly PLUGINS_READY_EVENT = 'plugins:ready';

  private readonly logger: Logger;
  private readonly tokens = new PluginInvocationTokens();
  private limits: { memoryMb: number; timeoutMs: number };
  private socketPath = '';
  private readonly proxy: PluginHostHttpProxy;
  private readonly registrations: PluginHostRegistrations;
  private readonly dispatcher: PluginHostDispatcher;
  private readonly callbacks: PluginHostCallbacks;
  private readonly settings: PluginIsolationSettings;
  private guest: IGuestProcess | null = null;
  private channel: PluginChannel | null = null;
  private context: PluginContext | null = null;
  private describeResult: { contractKeys: string[]; publicApiKeys: string[]; manifest: unknown } | null = null;
  private restarts = 0;
  private stopping = false;
  private restarting = false;
  private healthyTimer: NodeJS.Timeout | null = null;
  private wasEnabled = false;
  private initDeferred = false;

  constructor(
    readonly slug: string,
    private readonly pluginDir: string,
    private readonly entryPath: string,
    private manifest: Record<string, unknown>,
    private readonly manager: IPluginManagerInterface,
    settings: PluginIsolationSettings,
    private readonly projectRoot: string,
    /** The OS user the guest runs as when a privileged spawner exists; ignored by the fork launcher. */
    readonly identity: IGuestIdentity | null = null,
  ) {
    this.logger = new Logger({ namespace: `plugin-host:${slug}` });
    this.settings = settings;
    this.limits = settings.forPlugin(manifest.sandbox);
    this.proxy = new PluginHostHttpProxy('');
    this.callbacks = new PluginHostCallbacks(slug, (handlerId, args, store) => this.invoke({ kind: 'callback', handlerId, args }, store));
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
    this.socketPath = path.join(guest.socketDir, PluginHost.ROUTES_SOCKET);
    this.proxy.retarget(this.socketPath);
    guest.onOutput((stream, line) => (stream === 'stderr' ? this.logger.warn(line) : this.logger.info(line)));
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
    const described = await this.channel.request<{ contractKeys: string[]; publicApiKeys: string[]; manifest: unknown }>('boot', boot, PluginHost.BOOT_TIMEOUT_MS);
    this.describeResult = described;
    const who = launcher.isolatesIdentity && this.identity ? `, uid ${this.identity.uid}` : '';
    this.logger.info(`isolated process ${guest.pid} up (heap ${this.limits.memoryMb} MB, deadline ${this.limits.timeoutMs} ms${who})`);
    // A guest that stays up for a minute has earned its restart budget back: three failures in a
    // lifetime is a broken plugin, three failures a week apart is not.
    if (this.healthyTimer) clearTimeout(this.healthyTimer);
    this.healthyTimer = setTimeout(() => { this.restarts = 0; }, PluginHost.HEALTHY_AFTER_MS);
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
          if (this.initDeferred) { this.initDeferred = false; await this.invoke({ kind: 'lifecycle', name: 'onInit' }, undefined); }
        }
        if (key === 'onEnable') this.wasEnabled = true;
        if (key === 'onDisable') this.wasEnabled = false;
        return this.invoke({ kind: 'lifecycle', name: key, args: extra }, undefined);
      };
    }
    stubs.publicAPI = this.lazyPublicApi();
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
        return (...args: unknown[]) => host.invoke({ kind: 'public-api', name: prop, args }, RequestContextUtils.storage.getStore());
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

  private async invoke(work: Partial<IPluginInvocation> & { kind: IPluginInvocation['kind'] }, store: IRequestStore | undefined): Promise<unknown> {
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
        peers: this.peers(),
        enabledPlugins: this.enabledPlugins(store),
      };
      // About to wait on another process: hand the request's database connection back first. Held
      // through the wait, ten such waits emptied the pool and the guest's own calls then queued behind
      // them — a deadlock until the deadline. The next statement on this side takes a fresh one.
      await TenantConnectionScope.releaseCurrent();
      const result = await this.channel.request('invoke', invocation, work.kind === 'lifecycle' ? PluginHost.BOOT_TIMEOUT_MS : this.limits.timeoutMs);
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

  /** `/api/v1/plugins/seo/health?x=1` → `/seo/health?x=1`; null when the slug is not in the path. */
  static pluginPath(slug: string, fullPath: string): string | null {
    const marker = `/${slug}`;
    const index = fullPath.indexOf(marker);
    if (index < 0) return null;
    const rest = fullPath.slice(index + marker.length);
    if (rest !== '' && !rest.startsWith('/') && !rest.startsWith('?')) return null;
    return marker + (rest === '' ? '/' : rest);
  }

  private async serve(type: string, payload: any): Promise<unknown> {
    if (type === 'call') {
      if (!this.context) throw new Error(`plugin "${this.slug}" called the host before it had a context`);
      return this.dispatcher.dispatch(this.context, payload as IPluginRemoteCall);
    }
    if (type === 'register') {
      if (!this.context) throw new Error(`plugin "${this.slug}" registered before it had a context`);
      // Registrations are normally fire-and-forget, but one of them ANSWERS: `tenants.forEach` runs
      // the guest's work once per site and reports how many it ran for. Returning what `apply` gave
      // back is what lets the guest await its own count instead of a bare `true`.
      const answer = await this.registrations.apply(this.context, payload as IPluginGuestRegistration);
      return answer === undefined ? true : answer;
    }
    throw new Error(`host: unknown message "${type}"`);
  }

  private notified(type: string, payload: any): void {
    if (type !== 'log' || !this.context) return;
    const level = String(payload?.level ?? 'info') as 'info' | 'warn' | 'error';
    const target = (this.context.logger as any)[level] ?? this.context.logger.info;
    target.call(this.context.logger, String(payload?.msg ?? ''), ...(Array.isArray(payload?.meta) ? payload.meta : []));
  }

  /**
   * Who the guest may call, and it must agree with who the HOST will resolve.
   *
   * ACTIVE only. This listed every installed plugin with a public API, including disabled ones, so a
   * guest was told `broadcasts` was there, its `if (!broadcasts) return` guard passed, the call went
   * out, and the host answered `cannot read "registerProvider" of null` — by which point the plugin
   * had logged success. Two views of the same question, and the one the plugin could see was wrong.
   */
  private peers(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const plugin of this.manager.plugins.values()) {
      const api = plugin.publicAPI;
      if (!api) continue;
      if (PluginState.resolve(plugin.state) !== PluginState.ACTIVE) continue;
      // Own property names, not `Object.keys`: a class of static methods enumerates as nothing.
      out[`${String(plugin.manifest.namespace || '').trim()}:${plugin.manifest.slug}`] = PluginGuest.functionNames(api);
    }
    return out;
  }

  private enabledPlugins(store: IRequestStore | undefined): string[] {
    const tenantId = String(store?.tenantId ?? '').trim();
    const active = [...this.manager.plugins.values()].filter((p) => PluginState.resolve(p.state) === PluginState.ACTIVE).map((p) => p.manifest.slug);
    if (!tenantId) return active;
    const enabled = PluginTenantAccess.enabledSlugsFor(tenantId);
    return active.filter((slug) => enabled.has(slug));
  }

  private exited(code: number | null, signal: string | null): void {
    this.channel?.close(new Error(`plugin "${this.slug}" process exited (${signal ?? code})`));
    this.channel = null;
    this.guest = null;
    this.describeResult = null;
    this.tokens.revokeAll();
    if (this.stopping || this.restarting) return;
    void this.restart(`process exited (${signal ?? code})`);
  }

  /**
   * The plugin's files were replaced on disk (an update): a fresh process loads the new code, and the
   * old registrations are re-pointed at it exactly as after a crash — no api restart, no lost routes.
   * A guest that is not running (inactive plugin) has nothing to replace; its next `onEnable` loads the
   * new code anyway. Not counted against the restart budget: this is the operator's doing.
   */
  async reload(manifest: Record<string, unknown>): Promise<void> {
    this.manifest = manifest;
    this.limits = this.settings.forPlugin(manifest.sandbox);
    if (!this.guest && !this.channel) return;
    this.logger.info('plugin files replaced; starting a fresh process with the new code');
    this.restarting = true;
    try {
      await this.relaunch();
    } finally {
      this.restarting = false;
    }
  }

  /** Kill (if alive), start again, re-init (and re-enable when it was enabled). Shared by restart and reload. */
  private async relaunch(): Promise<void> {
    if (this.guest) { this.guest.kill('SIGKILL'); this.guest = null; this.channel?.close(); this.channel = null; this.describeResult = null; }
    await this.start();
    if (this.context) {
      this.registrations.resetForRestart(this.context);
      await this.invoke({ kind: 'lifecycle', name: 'onInit' }, undefined);
      if (this.wasEnabled) await this.invoke({ kind: 'lifecycle', name: 'onEnable' }, undefined);
      // A fresh process has an EMPTY memory: everything its PEERS registered into it (a fulfilment
      // provider, a search provider, a broadcasts content provider) is gone with the old one. Say
      // `plugins:ready` again — the same event peers already re-register on at boot — naming the
      // plugin that came back, so they register with it once more.
      const active = [...this.manager.plugins.values()].filter((p) => PluginState.resolve(p.state) === PluginState.ACTIVE).map((p) => p.manifest.slug);
      this.manager.hooks.emit(PluginHost.PLUGINS_READY_EVENT, { plugins: active, restarted: this.slug });
    }
  }

  /** Kill (if alive), then bring the guest back and re-run its init; after MAX_RESTARTS, disable with the reason. */
  private async restart(reason: string): Promise<void> {
    if (this.stopping || this.restarting) return;
    this.restarting = true;
    this.restarts += 1;
    if (this.restarts > PluginHost.MAX_RESTARTS) {
      this.logger.error(`${reason}; restarted ${PluginHost.MAX_RESTARTS} times already — disabling.`);
      this.restarting = false;
      await this.manager.disableWithError(this.slug, `Isolated plugin process failed repeatedly: ${reason}`);
      return;
    }
    const delayMs = 1000 * 2 ** (this.restarts - 1);
    this.logger.warn(`${reason}; restarting in ${delayMs} ms (attempt ${this.restarts}/${PluginHost.MAX_RESTARTS}).`);
    if (this.guest) { this.guest.kill('SIGKILL'); this.guest = null; this.channel?.close(); this.channel = null; this.describeResult = null; }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await this.relaunch();
      this.logger.info('guest restarted and re-initialised');
      this.restarting = false;
    } catch (error) {
      this.logger.error(`restart failed: ${error instanceof Error ? error.message : String(error)}`);
      this.restarting = false;
      void this.restart('restart failed');
    }
  }
}

import { PluginHostPublicApi } from '@core/plugin/host/plugin-host-public-api';
import path from 'path';
import { TenantConnectionScope } from '@fromcode119/database';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginSchemaDatabaseProxy } from '@core/plugin/context/plugin-schema-database-proxy';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginInvocationTokens } from '@core/plugin/host/plugin-invocation-tokens';
import { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { IPluginInvocation } from '@core/plugin/host/interfaces/plugin-invocation.interface';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { PluginContext } from '@core/plugin/plugin-context';
import { PluginHostGenerations } from '@core/plugin/host/generations/plugin-host-generations';
import { PluginHostState } from '@core/plugin/host/plugin-host-state';
import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';
import { PluginHostOutage } from '@core/plugin/host/outage/plugin-host-outage';
import { PluginChannelMessage } from '@core/plugin/host/enums/plugin-channel-message.enum';

/**
 * One isolated plugin, from the host's side: its process, its channel, its tokens, its stand-ins.
 *
 * The process is started with an EMPTY environment and a heap ceiling — as its own OS user when the
 * deployment has a privileged spawner (T5c) — and learns everything from the `boot` message. Every piece of work handed to it is one invocation with one token; every call it
 * makes back is dispatched under that token's tenant. A guest that dies is restarted with backoff and
 * re-initialised; after three deaths the plugin is disabled with the reason, and nothing else on the
 * platform notices either way.
 */
export class PluginHost extends PluginHostGenerations {
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
    this.socketPath = ''; this.guest = null; this.channel = null; this.context = null; this.generation = null; this.generationCount = 0;
    this.describeResult = null;
    this.sentPeerSignature = ''; this.restarts = 0; this.stopping = false; this.restarting = false;
    this.healthyTimer = null; this.wasEnabled = false; this.initDeferred = false; this.takenOver = null;
    this.settings = settings;
    this.limits = settings.forPlugin(manifest.sandbox);
    this.proxy = new PluginHostHttpProxy('');
    this.callbacks = new PluginHostCallbacks(slug, (handlerId, args, store) => this.invoke({ kind: String(PluginInvocationKind.CALLBACK.value), handlerId, args }, store));
    const plugin = { manifest } as unknown as ILoadedPlugin;
    const ddl = PluginSchemaDatabaseProxy.create(plugin, manager);
    this.dispatcher = new PluginHostDispatcher(slug, this.tokens, manager.db, ddl, this.callbacks);
    this.outage = new PluginHostOutage(
      slug,
      () => [...manager.registeredCollections].filter(([, entry]) => entry.pluginSlug === slug).flatMap(([physical, entry]) => [physical, entry.collection.slug, entry.collection.shortSlug].filter(Boolean)),
      () => GuestProcessLaunchers.unavailableReason() ?? (this.restarting ? 'its process is restarting' : 'its process is not running'),
    );
    this.registrations = new PluginHostRegistrations(
      slug,
      this.proxy,
      (kind, handlerId, args, store) => this.invoke({ kind: kind as IPluginInvocation['kind'], handlerId, args }, store),
      (req, res, next, targetPath, originalUrl) => this.forwardRequest(req, res, next, targetPath, originalUrl),
      // The RAW manager db: entering a site's scope binds a connection, and only this one can.
      manager.db,
      (steps, root) => this.dispatcher.declare(this.context!, steps, root),
    );
  }

  /**
   * What the guest's `context.i18n.defaultLocale()` answers: the site's own locale, else the
   * platform's AS IT IS NOW. The guest only held the platform locale it was booted with, so a saved
   * platform locale never reached an isolated plugin until its process was replaced.
   */
  private defaultLocaleFor(store: IRequestStore | undefined): string {
    return String(store?.siteLocale || this.manager.i18n?.getDefaultLocale?.() || '');
  }

  get limitsInEffect(): { memoryMb: number; timeoutMs: number } {
    return this.limits;
  }

  get pid(): number | null {
    return this.guest?.pid ?? null;
  }

  /** Starts this plugin's process when none is serving, and makes it the current one. */
  async start(): Promise<{ contractKeys: string[]; publicApiKeys: string[]; manifest: unknown }> {
    if (this.channel && !this.channel.isClosed && this.describeResult) return this.describeResult;
    this.stopping = false;
    const generation = (await this.takeOver()) ?? await this.launchGeneration();
    this.adopt(generation);
    return generation.described!;
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
        if (await this.restoreTakenOver(key)) return undefined;
        if (!this.isRunning) {
          if (this.deferWhileUnavailable(key)) return undefined;
          if (key === 'onInit') { this.initDeferred = true; return undefined; }
          if (key === 'onDisable' || key === 'onUninstall') return undefined;
          await this.resume(RequestContextUtils.storage.getStore());
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
    stubs.publicAPI = PluginHostPublicApi.lazy(this);
    // Carried so the resolver can tell "this peer is DOWN" from "this peer is broken" — see
    // `ILoadedPlugin.isRunning` for why it must survive the registry's spread as a function.
    stubs.isRunning = () => this.isRunning;
    return stubs;
  }

  private static readonly LIFECYCLE_KEYS = ['onInstall', 'onInit', 'onUpdate', 'onEnable', 'onDisable', 'onUninstall'] as const;

  get isRunning(): boolean {
    return !!this.channel && !this.channel.isClosed && !!this.describeResult;
  }


  bindContext(ctx: PluginContext): void {
    this.context = ctx;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.channel && !this.channel.isClosed) {
      await this.channel.request(String(PluginChannelMessage.STOP.value), {}, 5_000).catch(() => undefined);
    }
    this.guest?.kill('SIGKILL');
    this.guest = null;
    // Close the channel NOW rather than on the child's exit event: a lifecycle stub that runs in the
    // same tick (delete → disable) must see `isRunning === false`, not a channel about to disconnect.
    this.channel?.close();
    this.channel = null;
    this.generation = null;
    this.describeResult = null;
    this.sentPeerSignature = '';
    this.tokens.revokeAll();
  }

  /** Runs work in the CURRENT process, or in `channel`'s — a replacement's, while it initialises. */
  protected async invoke(work: Partial<IPluginInvocation> & { kind: IPluginInvocation['kind'] }, store: IRequestStore | undefined, channel: PluginChannel | null = this.channel): Promise<unknown> {
    if (!channel || channel.isClosed) throw new Error(`plugin "${this.slug}" is not running`);
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
        siteLocale: this.defaultLocaleFor(store),
        peers: this.peers(store),
        enabledPlugins: this.enabledPlugins(store),
      };
      this.rememberPeerSignature(invocation.peers, invocation.enabledPlugins);
      // About to wait on another process: hand the request's database connection back first. Held
      // through the wait, ten such waits emptied the pool and the guest's own calls then queued behind
      // them — a deadlock until the deadline. The next statement on this side takes a fresh one.
      await TenantConnectionScope.releaseCurrent();
      const result = await channel.request(String(PluginChannelMessage.INVOKE.value), invocation, work.kind === String(PluginInvocationKind.LIFECYCLE.value) ? PluginHostState.BOOT_TIMEOUT_MS : this.limits.timeoutMs);
      return this.callbacks.revive(result);
    } finally {
      this.tokens.revoke(token);
    }
  }

  private async forwardRequest(req: Request, res: Response, next: NextFunction, targetPath?: string, originalUrl?: string): Promise<void> {
    if (!this.channel || this.channel.isClosed) return this.outage.handle(req, res, next, targetPath);
    const store = RequestContextUtils.storage.getStore();
    const token = this.tokens.mint('route', store);
    try {
      // Express strips a `use('/slug/')` mount from `req.url` (`/health`, not `/slug/health`); the guest
      // mounted the same full path the host did, so forward everything from the plugin segment on.
      const target = targetPath ?? PluginHost.pluginPath(this.slug, `${req.baseUrl || ''}${req.url || ''}`) ?? req.url;
      // Same reason as in `invoke`: the guest serves this request for as long as it likes; the api's
      // connection must not sit idle in the meantime.
      await this.syncPeers(store);
      await TenantConnectionScope.releaseCurrent();
      await this.proxy.forward(req, res, next, { token, tenantId: String(store?.tenantId ?? '').trim() || null, locale: String(store?.locale ?? ''), siteLocale: this.defaultLocaleFor(store), targetPath: target, originalUrl, connectionId: this.generation?.connectionId }, this.limits.timeoutMs, () => this.restart('a request exceeded the deadline'));
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

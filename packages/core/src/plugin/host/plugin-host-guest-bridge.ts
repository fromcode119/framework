import type { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import { PluginHostState } from '@core/plugin/host/plugin-host-state';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';
import { LogLevel } from '@core/enums/log-level.enum';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import { PluginHostRuntimeReader } from '@core/plugin/host/runtime/plugin-host-runtime-reader';
import type { IPluginHostRuntime } from '@core/plugin/host/runtime/interfaces/plugin-host-runtime.interface';
import { PluginGuestRegistrationKind } from '@core/plugin/host/enums/plugin-guest-registration-kind.enum';
import { PluginGuestRegistrar } from '@core/plugin/host/registrations/plugin-guest-registrar';
import { PluginSiteDataContext } from '@core/plugin/tenant/plugin-site-data-context';
import type { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';
import { PluginHostPeerSnapshot } from '@core/plugin/host/plugin-host-peer-snapshot';

/**
 * What the guest asks of the HOST, and what happens when the guest dies.
 *
 * Every request a plugin makes back — a peer call, a notification, "which plugins are enabled" — is
 * answered here, under the token of the invocation that caused it, so a guest can never act outside
 * the tenant it was called for.
 *
 * Death is normal: a plugin can throw, leak or be killed by the OS, so it is restarted with backoff.
 * Only up to MAX_RESTARTS, though — a plugin that cannot survive three boots is broken, and a restart
 * loop burns the box while hiding the reason. Past that it is disabled WITH the reason.
 *
 * The base of `PluginHost`, which owns construction, start/stop and the stub surface.
 */
export abstract class PluginHostGuestBridge extends PluginHostState {
  protected async serve(type: string, payload: any, generation?: PluginGuestGeneration): Promise<unknown> {
    if (type === 'call') {
      if (!this.context) throw new Error(`plugin "${this.slug}" called the host before it had a context`);
      return this.dispatcher.dispatch(this.context, payload as IPluginRemoteCall);
    }
    if (type === 'register') {
      if (!this.context) throw new Error(`plugin "${this.slug}" registered before it had a context`);
      // A per-site replay of `onInit` does that site's data work with registration suppressed — the
      // first pass already registered everything. Skip it here and SAY so, so the plugin process does not
      // count it; a per-site run (`tenants.forEach`) is work, not a registration, and still runs.
      const registration = payload as IPluginGuestRegistration;
      if (PluginSiteDataContext.isSiteDataPass(this.context) && registration.kind !== PluginGuestRegistrationKind.TENANTS_FOR_EACH.value) return PluginGuestRegistrar.SUPPRESSED;
      // A REPLACEMENT that is still initialising: its standing registrations wait for the switch, so the
      // serving process's stand-ins stay in place until then; its per-site runs are work and run now, in it.
      const replacing = generation !== undefined && generation !== this.generation;
      if (replacing && registration.kind !== PluginGuestRegistrationKind.TENANTS_FOR_EACH.value) {
        generation.held.push(registration);
        return true;
      }
      // Registrations are normally fire-and-forget, but one of them ANSWERS: `tenants.forEach` runs
      // the guest's work once per site and reports how many it ran for. Returning what `apply` gave
      // back is what lets the guest await its own count instead of a bare `true`.
      const invoke = replacing ? (kind: string, handlerId: string, args: unknown[], store: IRequestStore | undefined) => this.invoke({ kind, handlerId, args }, store, generation.channel) : undefined;
      const answer = await this.registrations.apply(this.context, registration, invoke);
      return answer === undefined ? true : answer;
    }
    throw new Error(`host: unknown message "${type}"`);
  }

  protected notified(type: string, payload: any): void {
    if (type !== 'log' || !this.context) return;
    // The guest names a level; `LogLevel` owns that list. Its `.value` is the LABEL (`INFO`), and the
    // logger's method is the lower-case form of it — INFO when the guest says nothing usable, which is
    // what this did before and is the level a plugin's own `console.log` should land at.
    const level = LogLevel.find(payload?.level) ?? LogLevel.INFO;
    const target = (this.context.logger as any)[String(level.value).toLowerCase()] ?? this.context.logger.info;
    target.call(this.context.logger, String(payload?.msg ?? ''), ...(Array.isArray(payload?.meta) ? payload.meta : []));
  }

  /** The peers this plugin may call right now — see `PluginHostPeerSnapshot`. */
  protected peers(store: IRequestStore | undefined): Record<string, string[]> {
    return PluginHostPeerSnapshot.build(this.manager, store, this.logger);
  }

  protected enabledPlugins(store: IRequestStore | undefined): string[] {
    const tenantId = String(store?.tenantId ?? '').trim();
    const active = [...this.manager.plugins.values()].filter((p) => PluginState.resolve(p.state) === PluginState.ACTIVE).map((p) => p.manifest.slug);
    if (!tenantId) return active;
    const enabled = PluginTenantAccess.enabledSlugsFor(tenantId);
    return active.filter((slug) => enabled.has(slug));
  }

  /** This plugin's process for the admin: where it runs, as whom, its limits, and what it reports. */
  runtime(): Promise<IPluginHostRuntime> {
    const uid = GuestProcessLaunchers.current().isolatesIdentity && this.identity ? Number(this.identity.uid) : null;
    return PluginHostRuntimeReader.read({ slug: this.slug, running: Boolean(this.guest), pid: this.guest?.pid ?? null, uid, limits: this.limits, recentRestarts: Number(this.restarts) || 0 }, this.channel);
  }

  protected exited(code: number | null, signal: string | null): void {
    this.channel?.close(new Error(`plugin "${this.slug}" process exited (${signal ?? code})`));
    this.channel = null;
    this.guest = null;
    this.generation = null;
    this.describeResult = null; this.sentPeerSignature = '';
    // Mid-replacement the tokens in the map also belong to the process taking over; they must live.
    if (!this.restarting) this.tokens.revokeAll();
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

  /**
   * The platform's isolation limits were saved. A new deadline governs the next call as it is; a new
   * heap ceiling is a node flag fixed when the process starts, so a running guest whose ceiling
   * changed is replaced the same way an update replaces it. A manifest's own `sandbox` limits still
   * win, so a plugin that declares both sees no change and keeps its process.
   */
  async applySettings(settings: PluginIsolationSettings): Promise<void> {
    this.settings = settings;
    const next = settings.forPlugin(this.manifest.sandbox);
    const heapChanged = next.memoryMb !== this.limits.memoryMb;
    this.limits = next;
    if (!heapChanged || (!this.guest && !this.channel)) return;
    this.logger.info(`isolation limits changed; starting a fresh process with a ${next.memoryMb} MB heap`);
    this.restarting = true;
    try {
      await this.relaunch();
    } finally {
      this.restarting = false;
    }
  }

  /**
   * Replaces this plugin's process WITHOUT a gap. The next process starts BESIDE the current one and runs
   * `onInit` (and `onEnable`) while the current one keeps serving; then it takes over in one step, and the
   * one it replaced finishes what is in flight (up to the deadline) before it is retired. If the next one
   * fails, the current one simply keeps serving and the failure is the caller's to report.
   *
   * It used to be kill-then-start: until the new process had booted and mounted its routes, the plugin
   * answered 502 (nothing on the socket) and then 404 (a server with no routes yet), and hooks and jobs
   * fired in between failed. `drain: false` retires the replaced process at once — one past its deadline.
   */
  protected async relaunch(options: { drain: boolean } = { drain: true }): Promise<void> {
    const previous = this.generation && !this.generation.channel.isClosed ? this.generation : null;
    const next = await this.launchGeneration();
    try {
      if (this.context) {
        await this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: 'onInit' }, undefined, next.channel);
        if (this.wasEnabled) await this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: 'onEnable' }, undefined, next.channel);
      }
    } catch (error) {
      await next.retire();
      throw error;
    }
    // The switch, in ONE synchronous step, so nothing is dispatched to a half-switched plugin: the replaced
    // process's stand-ins go, the next one serves, and what it registered while initialising is applied.
    if (this.context) this.registrations.resetForRestart(this.context);
    this.adopt(next);
    if (this.context) {
      for (const registration of next.held.splice(0)) void this.registrations.apply(this.context, registration);
      // A fresh process has an EMPTY memory: everything its PEERS registered into it (a fulfilment
      // provider, a search provider, a newsletter content provider) is gone with the old one. Say
      // `plugins:ready` again — the same event peers already re-register on at boot — naming the
      // plugin that came back, so they register with it once more.
      const active = [...this.manager.plugins.values()].filter((p) => PluginState.resolve(p.state) === PluginState.ACTIVE).map((p) => p.manifest.slug);
      this.manager.hooks.emit(PluginHostState.PLUGINS_READY_EVENT, { plugins: active, restarted: this.slug });
    }
    if (previous) void previous.retireAfter(options.drain ? this.limits.timeoutMs : 0, (socketPath) => this.proxy.inFlight(socketPath), this.logger);
  }

  /** Makes `generation` the process that serves: routes, messages, and the restart budget's clock. */
  protected adopt(generation: PluginGuestGeneration): void {
    this.generation = generation;
    this.guest = generation.guest;
    this.channel = generation.channel;
    this.socketPath = generation.socketPath;
    this.proxy.retarget(this.socketPath);
    this.describeResult = generation.described;
    this.sentPeerSignature = '';
    // A guest that stays up for a minute has earned its restart budget back: three failures in a
    // lifetime is a broken plugin, three failures a week apart is not.
    if (this.healthyTimer) clearTimeout(this.healthyTimer);
    this.healthyTimer = setTimeout(() => { this.restarts = 0; }, PluginHostState.HEALTHY_AFTER_MS);
    this.healthyTimer.unref();
  }

  /** Kill (if alive), then bring the guest back and re-run its init; after MAX_RESTARTS, disable with the reason. */
  protected async restart(reason: string): Promise<void> {
    if (this.stopping || this.restarting) return;
    this.restarting = true;
    this.restarts += 1;
    if (this.restarts > PluginHostState.MAX_RESTARTS) {
      this.logger.error(`${reason}; restarted ${PluginHostState.MAX_RESTARTS} times already — disabling.`);
      this.restarting = false;
      await this.manager.disableWithError(this.slug, `Isolated plugin process failed repeatedly: ${reason}`);
      return;
    }
    const delayMs = 1000 * 2 ** (this.restarts - 1);
    this.logger.warn(`${reason}; restarting in ${delayMs} ms (attempt ${this.restarts}/${PluginHostState.MAX_RESTARTS}).`);
    // A process that is still ALIVE here overran its deadline: it keeps its channel until the replacement
    // has taken over, and is then retired without waiting for it (`drain: false`).
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await this.relaunch({ drain: false });
      this.logger.info('guest restarted and re-initialised');
      this.restarting = false;
    } catch (error) {
      this.logger.error(`restart failed: ${error instanceof Error ? error.message : String(error)}`);
      this.restarting = false;
      void this.restart('restart failed');
    }
  }

  /**
   * A guest learns which peers it may call from the envelope of an invocation. An HTTP request does
   * not travel that way — it goes straight to the guest's socket — so a guest that serves routes used
   * to answer them against whatever snapshot its last LIFECYCLE call left behind: the one taken at
   * BOOT, which excludes every sibling that had not finished loading yet. A shipping plugin booted
   * about a second before its courier adapter and so could never see it, and the courier's city
   * search answered an empty list for every query, for the life of the process.
   *
   * The snapshot is therefore refreshed before each forwarded request. Peers are tenant-dependent and
   * a guest holds exactly one snapshot, so the comparison is against what was last SENT rather than
   * against any single tenant's view: when it already matches, nothing crosses and the request costs
   * what it did before.
   */
  protected async syncPeers(store: IRequestStore | undefined): Promise<void> {
    if (!this.channel || this.channel.isClosed) return;
    const peers = this.peers(store);
    const enabledPlugins = this.enabledPlugins(store);
    const signature = PluginHostGuestBridge.peerSignature(peers, enabledPlugins);
    if (signature === this.sentPeerSignature) return;
    await this.channel.request('peers', { peers, enabledPlugins }, this.limits.timeoutMs);
    this.sentPeerSignature = signature;
  }

  /** Records what an invocation envelope already told the guest, so `syncPeers` does not repeat it. */
  protected rememberPeerSignature(peers: Record<string, string[]>, enabledPlugins: string[]): void {
    this.sentPeerSignature = PluginHostGuestBridge.peerSignature(peers, enabledPlugins);
  }

  /**
   * The whole snapshot, not just who is in it. A peer's FUNCTION NAMES change after the key set has
   * settled: a sibling that is still `loading` when the snapshot is taken has no `describeResult`
   * yet, so `lazyPublicApi`'s `ownKeys` answers `[]` and it is offered with an empty method list.
   * When it finishes loading the key set is identical, so a key-only signature matched and the
   * refresh was skipped — the guest kept the empty list for the life of the process.
   *
   * That is how a shipping plugin held its courier adapter as a peer it could see but not call:
   * `providerApi.searchCities` was undefined, and the city search answered nothing.
   */
  private static peerSignature(peers: Record<string, string[]>, enabledPlugins: string[]): string {
    const named = Object.keys(peers).sort().map((key) => [key, [...(peers[key] ?? [])].sort()]);
    return JSON.stringify([named, [...enabledPlugins].sort()]);
  }
}

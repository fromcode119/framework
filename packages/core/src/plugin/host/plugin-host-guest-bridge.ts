import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { IPluginRemoteCall } from '@core/plugin/host/interfaces/plugin-remote-call.interface';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import { PluginGuest } from '@core/plugin/host/plugin-guest';
import { PluginHostState } from '@core/plugin/host/plugin-host-state';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';
import { LogLevel } from '@core/enums/log-level.enum';

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
  protected async serve(type: string, payload: any): Promise<unknown> {
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

  protected notified(type: string, payload: any): void {
    if (type !== 'log' || !this.context) return;
    // The guest names a level; `LogLevel` owns that list. Its `.value` is the LABEL (`INFO`), and the
    // logger's method is the lower-case form of it — INFO when the guest says nothing usable, which is
    // what this did before and is the level a plugin's own `console.log` should land at.
    const level = LogLevel.find(payload?.level) ?? LogLevel.INFO;
    const target = (this.context.logger as any)[String(level.value).toLowerCase()] ?? this.context.logger.info;
    target.call(this.context.logger, String(payload?.msg ?? ''), ...(Array.isArray(payload?.meta) ? payload.meta : []));
  }

  /**
   * Who the guest may call, and it must agree with who the HOST will resolve.
   *
   * It asks `PluginsManagerResolver.isResolvable` — the SAME predicate the host applies when the call
   * lands — with the store the dispatcher will re-enter, so the two cannot disagree by construction.
   *
   * They have disagreed twice. First on state: this listed every installed plugin with a public API,
   * including disabled ones, so a guest was told `broadcasts` was there, its `if (!broadcasts) return`
   * guard passed, the call went out, and the host answered `cannot read "registerProvider" of null` —
   * by which point the plugin had logged success. That was fixed by filtering to ACTIVE. Then on the
   * TENANT: the snapshot still had no tenant axis while the resolver did, so during the per-site
   * replay of `onInit` a guest was again told yes and again refused, and the operator was shown a
   * WARN saying registration had FAILED for a peer simply not enabled on that site.
   */
  protected peers(store: IRequestStore | undefined): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    const tenantId = String(store?.tenantId ?? '').trim() || null;
    let walked = 0;
    let offered = 0;
    for (const plugin of this.manager.plugins.values()) {
      walked += 1;
      const refusal = PluginsManagerResolver.refusalReason(plugin, tenantId);
      if (refusal) {
        // A withheld peer used to leave no trace at all. The caller saw only an absence — a courier
        // search that answered "no cities" having asked nobody — and which condition withheld it
        // could only be guessed at from outside the process.
        //
        // EVERY refusal is said, including "exposes no public API". Filtering on `publicAPI` to keep
        // the noise down silenced exactly that reason, so a plugin missing its API looked identical
        // to one that was never a peer — which is the shape of the failure this line exists for. A
        // debug level is where the volume belongs, not a filter that can hide the answer.
        //
        // The HOST's own logger, not `this.context.logger`: the context is null until the guest has
        // one, and the plugin-facing logger has no debug level.
        this.logger.debug(`peer withheld — ${refusal}`);
        continue;
      }
      // Own property names, not `Object.keys`: a class of static methods enumerates as nothing.
      out[`${String(plugin.manifest.namespace || '').trim()}:${plugin.manifest.slug}`] = PluginGuest.functionNames(plugin.publicAPI);
      offered += 1;
    }
    /**
     * What this snapshot WALKED, not only what it kept.
     *
     * A peer can be missing three ways and only two of them leave a trace: refused (logged above) or
     * mis-keyed (visible in the guest's own list). The third — never in `manager.plugins` at all — is
     * silent from both ends, and on a live site that is where a courier plugin went: present in the
     * health count, running its own scheduler, and absent from every peer snapshot with no refusal
     * recorded anywhere. The walked count is what tells those apart in one line.
     */
    // The COUNT per peer, not just its name. A peer offered with zero functions is one the caller
    // can see and cannot call: `has()` answers true, every method is undefined, and nothing is
    // refused or logged anywhere. Without this number that state is indistinguishable from a
    // healthy snapshot, which is exactly how logistics held logistics-econt for days.
    const described = Object.entries(out).map(([key, fns]) => `${key}(${fns.length})`).join(', ');
    this.logger.debug(`peer snapshot: walked ${walked} plugin(s), offered ${offered} — ${described || '(none)'}`);
    return out;
  }

  protected enabledPlugins(store: IRequestStore | undefined): string[] {
    const tenantId = String(store?.tenantId ?? '').trim();
    const active = [...this.manager.plugins.values()].filter((p) => PluginState.resolve(p.state) === PluginState.ACTIVE).map((p) => p.manifest.slug);
    if (!tenantId) return active;
    const enabled = PluginTenantAccess.enabledSlugsFor(tenantId);
    return active.filter((slug) => enabled.has(slug));
  }

  protected exited(code: number | null, signal: string | null): void {
    this.channel?.close(new Error(`plugin "${this.slug}" process exited (${signal ?? code})`));
    this.channel = null;
    this.guest = null;
    this.describeResult = null; this.sentPeerSignature = '';
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
  protected async relaunch(): Promise<void> {
    if (this.guest) { this.guest.kill('SIGKILL'); this.guest = null; this.channel?.close(); this.channel = null; this.describeResult = null; this.sentPeerSignature = ''; }
    await this.start();
    if (this.context) {
      this.registrations.resetForRestart(this.context);
      await this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: 'onInit' }, undefined);
      if (this.wasEnabled) await this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: 'onEnable' }, undefined);
      // A fresh process has an EMPTY memory: everything its PEERS registered into it (a fulfilment
      // provider, a search provider, a broadcasts content provider) is gone with the old one. Say
      // `plugins:ready` again — the same event peers already re-register on at boot — naming the
      // plugin that came back, so they register with it once more.
      const active = [...this.manager.plugins.values()].filter((p) => PluginState.resolve(p.state) === PluginState.ACTIVE).map((p) => p.manifest.slug);
      this.manager.hooks.emit(PluginHostState.PLUGINS_READY_EVENT, { plugins: active, restarted: this.slug });
    }
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
    if (this.guest) { this.guest.kill('SIGKILL'); this.guest = null; this.channel?.close(); this.channel = null; this.describeResult = null; this.sentPeerSignature = ''; }
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

  /**
   * A guest learns which peers it may call from the envelope of an invocation. An HTTP request does
   * not travel that way — it goes straight to the guest's socket — so a guest that serves routes used
   * to answer them against whatever snapshot its last LIFECYCLE call left behind: the one taken at
   * BOOT, which excludes every sibling that had not finished loading yet. Logistics booted about a
   * second before logistics-econt and so could never see it, and Econt city search answered an empty
   * list for every query, for the life of the process.
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
   * That is how `logistics` held `logistics-econt` as a peer it could see but not call:
   * `providerApi.searchCities` was undefined, and the city search answered nothing.
   */
  private static peerSignature(peers: Record<string, string[]>, enabledPlugins: string[]): string {
    const named = Object.keys(peers).sort().map((key) => [key, [...(peers[key] ?? [])].sort()]);
    return JSON.stringify([named, [...enabledPlugins].sort()]);
  }
}

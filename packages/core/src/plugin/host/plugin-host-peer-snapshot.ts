import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import type { Logger } from '@core/logging';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import { PluginGuest } from '@core/plugin/host/plugin-guest';

/** The peers a plugin process may call, as sent with each invocation — moved out of the host to keep it small. */
export class PluginHostPeerSnapshot {
  /**
   * Who the guest may call, and it must agree with who the HOST will resolve.
   *
   * It asks `PluginsManagerResolver.isResolvable` — the SAME predicate the host applies when the call
   * lands — with the store the dispatcher will re-enter, so the two cannot disagree by construction.
   *
   * They have disagreed twice. First on state: this listed every installed plugin with a public API,
   * including disabled ones, so a guest was told `ledger` was there, its `if (!ledger) return`
   * guard passed, the call went out, and the host answered `cannot read "registerProvider" of null` —
   * by which point the plugin had logged success. That was fixed by filtering to ACTIVE. Then on the
   * TENANT: the snapshot still had no tenant axis while the resolver did, so during the per-site
   * replay of `onInit` a guest was again told yes and again refused, and the operator was shown a
   * WARN saying registration had FAILED for a peer simply not enabled on that site.
   */
  static build(manager: { plugins: Map<string, any> }, store: IRequestStore | undefined, logger: Logger): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    const tenantId = String(store?.tenantId ?? '').trim() || null;
    let walked = 0;
    let offered = 0;
    for (const plugin of manager.plugins.values()) {
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
        logger.debug(`peer withheld — ${refusal}`);
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
    // healthy snapshot, which is exactly how a shipping plugin held its courier adapter for days.
    const described = Object.entries(out).map(([key, fns]) => `${key}(${fns.length})`).join(', ');
    logger.debug(`peer snapshot: walked ${walked} plugin(s), offered ${offered} — ${described || '(none)'}`);
    return out;
  }
}

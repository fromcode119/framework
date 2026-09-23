import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

/**
 * `context.plugins.namespace(ns)` as a GUEST sees it.
 *
 * Split out of `PluginGuestContextFactory` when that file passed its size limit: this is one
 * self-contained question — who may this guest call, and what does it do when the answer is no.
 */
export class PluginGuestPeerNamespace {
  /**
   * `context.plugins.namespace(ns)` for a guest, answering truthfully about who is there.
   *
   * A remote reference is a lazy chain: every property access returns another chain, so it is ALWAYS
   * truthy. In-process, `namespace('org.fromcode').ledger` is `undefined` when ledger is not
   * running, and plugins guard on exactly that — `if (!ledger) return;`. Inside a guest the same
   * guard passed for a plugin that did not exist, the call went out, and the HOST reported
   * `cannot read "registerProvider" of null` while the plugin had already logged success and set its
   * "registered" flag. The failure landed in the api log; the plugin believed the opposite.
   *
   * The guest already knows the peer set (`state.hasPeer`) — it is sent at boot for `has()` and
   * `get()`. This makes `namespace()` use it, so one guard works the same in both worlds.
   */
  static build(
    namespace: string,
    state: { hasPeer(ns: string, slug: string): boolean; peerKeys(): string[] },
    remote: PluginGuestRemote,
    log?: (message: string) => void,
  ): Record<string, unknown> {
    /**
     * A miss, said out loud — with what was asked for and what was actually there.
     *
     * The host now explains a peer it WITHHELD, but a guest can miss for a reason the host never
     * sees: asking in the wrong namespace. Both produce the same silent `false`, and on a live site
     * that was the difference between a courier search that asked nobody and one that worked. The
     * key and the available keys together say which of the two it is in one line.
     */
    const miss = (slug: string) => {
      if (!log) return;
      log(`no peer "${namespace}:${slug}" — this guest knows: ${state.peerKeys().join(', ') || '(none)'}`);
    };
    const peerRef = (slug: string) => remote.ref('context', [
      { name: 'plugins' }, { name: 'namespace', args: [namespace] }, { name: slug },
    ]);
    const facadeCall = (method: string, args: unknown[]) => remote.ref('context', [
      { name: 'plugins' }, { name: 'namespace', args: [namespace] }, { name: method, args },
    ]);

    /**
     * The facade's own methods, which are NOT plugin slugs.
     *
     * `has` was previously only a Proxy TRAP — the `in` operator — while plugins call it as a
     * METHOD. So `ns.has('billing')` looked `has` up as if it were a plugin, found no such peer,
     * returned undefined, and threw "ns.has is not a function". That took a plugin down on every boot.
     *
     * The three that decide control flow are answered from the peer set the guest already holds, so
     * they stay SYNCHRONOUS exactly as in-process. Returning a remote chain instead would be worse
     * than the crash: a chain is always truthy, so `if (ns.has(x))` would take the branch for a
     * plugin that is not there.
     */
    const methods: Record<string, unknown> = {
      has: (slug: unknown) => {
        const name = String(slug ?? '');
        const found = state.hasPeer(namespace, name);
        if (!found) miss(name);
        return found;
      },
      get: (slug: unknown) => {
        const name = String(slug ?? '');
        if (state.hasPeer(namespace, name)) return peerRef(name);
        miss(name);
        return null;
      },
      require: (slug: unknown) => {
        const name = String(slug ?? '');
        if (!state.hasPeer(namespace, name)) {
          miss(name);
          throw new Error(`Plugin "${name}" is not available in namespace "${namespace}".`);
        }
        return peerRef(name);
      },
      getNamespace: () => namespace,
      // Async in-process too, so a remote chain has the same shape a caller already awaits.
      call: (...args: unknown[]) => facadeCall('call', args),
      callOperation: (...args: unknown[]) => facadeCall('callOperation', args),
      getCapabilities: (...args: unknown[]) => facadeCall('getCapabilities', args),
      getOperations: (...args: unknown[]) => facadeCall('getOperations', args),
      supportsOperation: (...args: unknown[]) => facadeCall('supportsOperation', args),
      // Sync in-process and unanswerable here — it needs the peer's API shape, which lives in the
      // host. A chain would be always-truthy, so this says so instead of guessing.
      hasMethod: (slug: unknown, method: unknown) => {
        throw new Error(
          `hasMethod("${String(slug)}", "${String(method)}") is not available to an isolated plugin: `
          + 'the answer lives in the host process and cannot be given synchronously. '
          + `Use await context.plugins.namespace("${namespace}").call(...), which returns null when the method is absent.`,
        );
      },
    };

    return new Proxy({}, {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined;
        const name = String(prop);
        if (name in methods) return methods[name];
        if (!state.hasPeer(namespace, name)) return undefined;
        return peerRef(name);
      },
      has(_target, prop) {
        return typeof prop === 'string' && state.hasPeer(namespace, String(prop));
      },
    }) as Record<string, unknown>;
  }
}

import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

/**
 * `context.settings` for an isolated plugin, reading each answer ONCE per invocation.
 *
 * A plugin reads its settings wherever it needs one — a price helper, a stock rule, a formatter — and
 * one storefront request reached the same row three times, each a round trip to the api and a query.
 * Within one invocation the answer cannot change unless the plugin changes it itself, so the first read
 * is shared by the rest of that invocation and by nothing else: the memo is keyed by the invocation's
 * own store and goes with it, so an admin's save is seen by the very next request. `update` forgets the
 * invocation's reads before it writes. Every caller receives its own copy, as it did from the api.
 * Work outside any invocation (boot) reads straight through.
 */
export class PluginGuestSettings {
  private readonly reads = new WeakMap<object, Map<string, Promise<unknown>>>();

  constructor(private readonly base: Record<string | symbol, any>) {}

  proxy(): unknown {
    const settings = this;
    return new Proxy(this.base, {
      get(target, prop, receiver) {
        if (prop === 'get') return (...args: unknown[]) => settings.get(args);
        if (prop === 'update') return (...args: unknown[]) => settings.update(args);
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  private async get(args: unknown[]): Promise<unknown> {
    const invocation = PluginGuestRemote.invocation.getStore();
    if (!invocation) return this.base.get(...args);
    let reads = this.reads.get(invocation);
    if (!reads) {
      reads = new Map();
      this.reads.set(invocation, reads);
    }
    const key = JSON.stringify(args);
    let read = reads.get(key);
    if (!read) {
      read = Promise.resolve(this.base.get(...args));
      reads.set(key, read);
      // A failed read is not an answer: the next caller asks again.
      read.catch(() => { if (reads!.get(key) === read) reads!.delete(key); });
    }
    return structuredClone(await read);
  }

  private update(args: unknown[]): unknown {
    const invocation = PluginGuestRemote.invocation.getStore();
    if (invocation) this.reads.delete(invocation);
    return this.base.update(...args);
  }
}

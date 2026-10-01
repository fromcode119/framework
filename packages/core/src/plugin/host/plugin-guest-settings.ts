import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

/**
 * `context.settings` for an isolated plugin, reading each answer once per site and content revision.
 *
 * A plugin reads its settings wherever it needs one — a price helper, a stock rule, a formatter — and
 * every read was a round trip to the api and a query: three per storefront product list. The api now
 * hands each invocation its site's content revision (SiteContentRevision) and the operator's maximum
 * age for kept answers (Settings → Infrastructure → API response cache). A read is kept under the site,
 * that revision and its arguments: any save of the plugin's settings — or anything else that moves the
 * site's revision — changes the key, so the next request reads afresh. The age limit is the backstop
 * for a change that reached this process late, and 0 keeps nothing.
 *
 * Without a revision (an api that sends none, boot work) a read is shared only within its invocation,
 * as before. `update` forgets the invocation's reads and the site's kept ones before it writes. Every
 * caller receives its own copy, as it did from the api.
 */
export class PluginGuestSettings {
  /** Kept reads stay few: one per site and argument list, under the current revision. */
  private static readonly MAX_KEPT = 256;

  private readonly reads = new WeakMap<object, Map<string, Promise<unknown>>>();
  private readonly kept = new Map<string, { read: Promise<unknown>; at: number }>();

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
      read = this.keptRead(invocation, key, args);
      reads.set(key, read);
      // A failed read is not an answer: the next caller asks again.
      read.catch(() => { if (reads!.get(key) === read) reads!.delete(key); });
    }
    return structuredClone(await read);
  }

  private keptRead(invocation: { tenantId: string | null; revision?: string; cacheMaxAgeMs?: number }, key: string, args: unknown[]): Promise<unknown> {
    const maxAgeMs = Number(invocation.cacheMaxAgeMs) || 0;
    if (!invocation.revision || !(maxAgeMs > 0)) return Promise.resolve(this.base.get(...args));
    const keptKey = `${PluginGuestSettings.site(invocation.tenantId)}${invocation.revision}\u0000${key}`;
    const now = Date.now();
    const kept = this.kept.get(keptKey);
    if (kept && now - kept.at < maxAgeMs) return kept.read;
    const read = Promise.resolve(this.base.get(...args));
    if (this.kept.size >= PluginGuestSettings.MAX_KEPT) this.kept.delete(this.kept.keys().next().value as string);
    this.kept.set(keptKey, { read, at: now });
    read.catch(() => { if (this.kept.get(keptKey)?.read === read) this.kept.delete(keptKey); });
    return read;
  }

  private update(args: unknown[]): unknown {
    const invocation = PluginGuestRemote.invocation.getStore();
    if (invocation) {
      this.reads.delete(invocation);
      // The save moves the site's revision on the api; until a request carries the new one, nothing kept
      // for this site under the old one may answer it.
      const site = PluginGuestSettings.site(invocation.tenantId);
      for (const keptKey of [...this.kept.keys()]) if (keptKey.startsWith(site)) this.kept.delete(keptKey);
    }
    return this.base.update(...args);
  }

  private static site(tenantId: string | null): string {
    return `${tenantId ?? ''}\u0000`;
  }
}

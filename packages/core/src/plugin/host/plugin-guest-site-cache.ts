import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

/**
 * Answers a plugin process keeps for a site, under the content revision the api handed the current
 * invocation (SiteContentRevision) and never longer than the operator's maximum age (Settings →
 * Infrastructure → API response cache; 0 keeps nothing).
 *
 * Anything that changes a site moves its revision — a settings save, a plugin's table write, a content
 * edit, a purge — so a changed site is read afresh by the next request that carries the new revision.
 * Kept per site: one plugin process serves every site, and no site is answered from another's read.
 * Work that carries no revision (boot, an api that sends none) keeps nothing.
 */
export class PluginGuestSiteCache {
  /** Few entries are kept: one per site and key under the current revision. */
  private static readonly MAX_KEPT = 512;

  private readonly kept = new Map<string, { read: Promise<unknown>; at: number }>();

  /** `compute`'s answer for `key`, kept for this site and revision when the invocation allows it. */
  read(key: string, compute: () => unknown): Promise<unknown> {
    const invocation = PluginGuestRemote.invocation.getStore();
    const maxAgeMs = Number(invocation?.cacheMaxAgeMs) || 0;
    if (!invocation?.revision || !(maxAgeMs > 0)) return Promise.resolve().then(compute);
    const keptKey = `${PluginGuestSiteCache.site(invocation.tenantId)}${invocation.revision}\u0000${key}`;
    const now = Date.now();
    const kept = this.kept.get(keptKey);
    if (kept && now - kept.at < maxAgeMs) return kept.read;
    const read = Promise.resolve().then(compute);
    if (this.kept.size >= PluginGuestSiteCache.MAX_KEPT) this.kept.delete(this.kept.keys().next().value as string);
    this.kept.set(keptKey, { read, at: now });
    // A failed read is not an answer: the next caller asks again.
    read.catch(() => { if (this.kept.get(keptKey)?.read === read) this.kept.delete(keptKey); });
    return read;
  }

  /** Drops what is kept for the current invocation's site, e.g. before the plugin writes what it read. */
  forgetCurrentSite(): void {
    const invocation = PluginGuestRemote.invocation.getStore();
    if (!invocation) return;
    const site = PluginGuestSiteCache.site(invocation.tenantId);
    for (const keptKey of [...this.kept.keys()]) if (keptKey.startsWith(site)) this.kept.delete(keptKey);
  }

  private static site(tenantId: string | null): string {
    return `${tenantId ?? ''}\u0000`;
  }
}

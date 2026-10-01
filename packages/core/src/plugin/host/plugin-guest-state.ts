import type { IPluginInvocation } from '@core/plugin/host/interfaces/plugin-invocation.interface';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

/**
 * What the guest knows about the platform around it, refreshed from every invocation envelope.
 *
 * `context.plugins.has/get/optional/isEnabled` are SYNCHRONOUS in the contract (`if (ledger) …`), so
 * the guest cannot ask the host each time. The host therefore sends, with every piece of work, which
 * peer APIs exist and which plugins the current tenant runs; these answers come from that snapshot.
 *
 * One snapshot PER SITE, read for the site of the work running now. A single snapshot was replaced by
 * every envelope, so on a multi-site platform a request of a site that runs a peer, overlapping one of
 * a site that does not, answered "Missing required dependency" — intermittently, under load only.
 */
export class PluginGuestState {
  private static readonly EMPTY = { peers: {} as Record<string, string[]>, enabledPlugins: new Set<string>() };
  private readonly sites = new Map<string, { peers: Record<string, string[]>; enabledPlugins: Set<string> }>();

  /** `tenantId` is the envelope's site; an envelope without one (an older api, platform work) is the `''` site. */
  update(envelope: Pick<IPluginInvocation, 'peers' | 'enabledPlugins'> & { tenantId?: string | null }): void {
    const key = PluginGuestState.key(envelope.tenantId);
    const site = this.sites.get(key) ?? { peers: {}, enabledPlugins: new Set<string>() };
    if (envelope.peers && typeof envelope.peers === 'object') site.peers = envelope.peers;
    if (Array.isArray(envelope.enabledPlugins)) site.enabledPlugins = new Set(envelope.enabledPlugins.map(String));
    this.sites.set(key, site);
  }

  hasPeer(namespace: string, slug: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.current().peers, `${namespace}:${slug}`);
  }

  /** Every peer this guest currently knows, as `namespace:slug` — for saying what it looked among. */
  peerKeys(): string[] {
    return Object.keys(this.current().peers);
  }

  peerFunctions(namespace: string, slug: string): string[] {
    return this.current().peers[`${namespace}:${slug}`] ?? [];
  }

  isEnabled(slug: string): boolean {
    return this.current().enabledPlugins.has(String(slug));
  }

  /** The snapshot of the site whose work is running; the platform's (`''`) until that site's arrives. */
  private current(): { peers: Record<string, string[]>; enabledPlugins: Set<string> } {
    const key = PluginGuestState.key(PluginGuestRemote.invocation.getStore()?.tenantId);
    return this.sites.get(key) ?? this.sites.get('') ?? PluginGuestState.EMPTY;
  }

  private static key(tenantId: unknown): string {
    return String(tenantId ?? '').trim();
  }
}

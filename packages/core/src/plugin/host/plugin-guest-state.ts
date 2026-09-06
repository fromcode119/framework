import type { IPluginInvocation } from '@core/plugin/host/interfaces/plugin-invocation.interface';

/**
 * What the guest knows about the platform around it, refreshed from every invocation envelope.
 *
 * `context.plugins.has/get/optional/isEnabled` are SYNCHRONOUS in the contract (`if (mlm) …`), so
 * the guest cannot ask the host each time. The host therefore sends, with every piece of work, which
 * peer APIs exist and which plugins the current tenant runs; these answers come from that snapshot.
 */
export class PluginGuestState {
  private peers: Record<string, string[]> = {};
  private enabledPlugins = new Set<string>();

  update(envelope: Pick<IPluginInvocation, 'peers' | 'enabledPlugins'>): void {
    if (envelope.peers && typeof envelope.peers === 'object') this.peers = envelope.peers;
    if (Array.isArray(envelope.enabledPlugins)) this.enabledPlugins = new Set(envelope.enabledPlugins.map(String));
  }

  hasPeer(namespace: string, slug: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.peers, `${namespace}:${slug}`);
  }

  peerFunctions(namespace: string, slug: string): string[] {
    return this.peers[`${namespace}:${slug}`] ?? [];
  }

  isEnabled(slug: string): boolean {
    return this.enabledPlugins.has(String(slug));
  }
}

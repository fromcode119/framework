import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';

/**
 * Reads a manifest's `network` declaration and answers whether a host is inside it.
 *
 * The declaration is part of what an operator approves: each host becomes an entry of the approved set
 * (`network:host:api.payments.example`, or `network:any`), so a release that reaches a new host is held for
 * approval exactly like one that asks for a new capability.
 */
export class PluginNetworkDeclaration {
  static readonly ANY_TOKEN = 'network:any';
  static readonly HOST_TOKEN_PREFIX = 'network:host:';

  /** A host name, or `*.` and a host name. Lowercase letters, digits, dots and hyphens only. */
  private static readonly HOST_PATTERN = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

  /** Whether `value` is a host name, or `*.` and a host name. */
  static isHost(value: string): boolean {
    return PluginNetworkDeclaration.HOST_PATTERN.test(String(value ?? '').trim().toLowerCase());
  }

  /** The declared hosts, normalized: lowercase, trimmed, de-duplicated, sorted. Invalid entries are dropped. */
  static hosts(manifest: IPluginManifest): string[] {
    const declared = Array.isArray(manifest.network?.hosts) ? manifest.network!.hosts : [];
    const hosts = declared
      .map((host) => String(host ?? '').trim().toLowerCase())
      .filter((host) => PluginNetworkDeclaration.HOST_PATTERN.test(host));
    return [...new Set(hosts)].sort();
  }

  /** Entries in `network.hosts` that are not host names — reported, never silently ignored. */
  static invalidHosts(manifest: IPluginManifest): string[] {
    const declared = Array.isArray(manifest.network?.hosts) ? manifest.network!.hosts : [];
    return declared
      .map((host) => String(host ?? '').trim().toLowerCase())
      .filter((host) => !PluginNetworkDeclaration.HOST_PATTERN.test(host));
  }

  /**
   * Every host: declared as `any`, or — for a plugin that asks for `network` and names no hosts at all —
   * assumed, so a plugin written before declarations existed keeps working. Either way it is shown and
   * approved as "any internet address", the riskiest entry, never granted silently.
   */
  static allowsAnyHost(manifest: IPluginManifest): boolean {
    return manifest.network?.any === true || manifest.network === undefined || manifest.network === null;
  }

  static anyHostReason(manifest: IPluginManifest): string {
    return String(manifest.network?.reason ?? '').trim();
  }

  /** The approval entries this declaration contributes. Nothing unless the plugin asks for `network`. */
  static tokens(manifest: IPluginManifest): string[] {
    if (PluginNetworkDeclaration.allowsAnyHost(manifest)) return [PluginNetworkDeclaration.ANY_TOKEN];
    return PluginNetworkDeclaration.hosts(manifest).map((host) => PluginNetworkDeclaration.HOST_TOKEN_PREFIX + host);
  }

  static isToken(entry: string): boolean {
    return entry === PluginNetworkDeclaration.ANY_TOKEN || entry.startsWith(PluginNetworkDeclaration.HOST_TOKEN_PREFIX);
  }

  /**
   * Whether `hostname` is one this plugin was approved to reach: listed in its manifest AND in its
   * approved set. Both, because the manifest of a running plugin can change under it (a hot update) and
   * the approved set is what a person saw.
   */
  static permits(manifest: IPluginManifest, approved: readonly string[], hostname: string): boolean {
    const host = String(hostname ?? '').trim().toLowerCase().replace(/\.$/, '');
    if (!host) return false;
    if (PluginNetworkDeclaration.allowsAnyHost(manifest)) return approved.includes(PluginNetworkDeclaration.ANY_TOKEN);
    return PluginNetworkDeclaration.hosts(manifest).some((declared) =>
      PluginNetworkDeclaration.matches(declared, host)
      && approved.includes(PluginNetworkDeclaration.HOST_TOKEN_PREFIX + declared));
  }

  /** Refuses a target outside what the plugin was approved to reach; `onRefused` records it first. */
  static assertReachable(plugin: { manifest: IPluginManifest; approvedCapabilities?: string[] }, target: string, onRefused: () => void): void {
    const host = PluginNetworkDeclaration.hostOf(target);
    if (PluginNetworkDeclaration.permits(plugin.manifest, plugin.approvedCapabilities || [], host)) return;
    onRefused();
    throw new Error(`Plugin "${plugin.manifest.slug}" may not reach ${host || target}: it is not a host this plugin was approved to reach.`);
  }

  /** The host of a URL-shaped target (`https://x/…`, `imap://mail.x:993`); empty when there is none. */
  static hostOf(target: string): string {
    try {
      return new URL(String(target ?? '')).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    } catch {
      return '';
    }
  }

  private static matches(declared: string, host: string): boolean {
    if (!declared.startsWith('*.')) return declared === host;
    const suffix = declared.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }
}

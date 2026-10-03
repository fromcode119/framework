import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { PluginNetworkDeclaration } from '@core/plugin/consent/plugin-network-declaration';

/**
 * Everything an operator approves for a plugin, as one flat list of entries: each capability its
 * manifest declares, and — when it declares `network` — each host it may reach.
 *
 * A plugin RUNS only while this whole list is inside its approved set. Every lifecycle transition
 * (boot, enable, a hot update, a Sources build) checks it, so a release that asks for more than a
 * person saw waits for that person instead of quietly gaining it.
 */
export class PluginConsentSet {
  private static readonly NETWORK = 'network';

  /** The entries this manifest asks for: lowercase, de-duplicated, sorted. */
  static of(manifest: IPluginManifest): string[] {
    const capabilities = (manifest.capabilities || []).map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
    const entries = new Set(capabilities);
    if (entries.has(PluginConsentSet.NETWORK) || entries.has('*')) {
      for (const token of PluginNetworkDeclaration.tokens(manifest)) entries.add(token);
    }
    return [...entries].sort();
  }

  /** What the manifest asks for that the approved set does not hold. Empty means it may run. */
  static missing(manifest: IPluginManifest, approved: readonly string[] | undefined): string[] {
    const held = new Set((approved || []).map((entry) => String(entry).toLowerCase()));
    return PluginConsentSet.of(manifest).filter((entry) => !held.has(entry));
  }

  static covers(manifest: IPluginManifest, approved: readonly string[] | undefined): boolean {
    return PluginConsentSet.missing(manifest, approved).length === 0;
  }

  /** Whether `submitted` is exactly what this manifest asks for now — the check behind an approval. */
  static matches(manifest: IPluginManifest, submitted: readonly string[] | undefined): boolean {
    const wanted = PluginConsentSet.of(manifest);
    const given = [...new Set((submitted || []).map((entry) => String(entry).trim().toLowerCase()))].sort();
    return wanted.length === given.length && wanted.every((entry, index) => entry === given[index]);
  }

  /**
   * An approval recorded before hosts were part of it: it holds `network` and no host entry at all.
   * Such a plugin was approved to reach anything; its first declaration is carried over once, and the
   * caller says so to the operator, rather than holding every plugin that talks to the internet.
   */
  static predatesHostApproval(approved: readonly string[] | undefined): boolean {
    const entries = approved || [];
    return entries.includes(PluginConsentSet.NETWORK) && !entries.some((entry) => PluginNetworkDeclaration.isToken(entry));
  }
}

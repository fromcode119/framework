import type { IResolvedPluginDefaultPageContract } from '@fromcode119/core';
import type { IResolutionScanEntry } from '@api/services/helpers/interfaces/resolution-scan-entry.interface';

/**
 * Finding the collection a default-page contract resolves against.
 *
 * Both lookups skip collections whose plugin is not active, so a disabled plugin's routes stop
 * resolving rather than serving records nothing else in the platform will render. `system` is the
 * exception: the framework's own collections are never in the active-plugin set.
 */
export class ResolutionCollectionLookup {
  /** The framework's own owner slug, which is never listed as an active plugin. */
  private static readonly SYSTEM_OWNER = 'system';

  private static isUsable(entry: IResolutionScanEntry, activePlugins: Set<string>): boolean {
    if (!entry.collection) return false;
    return entry.pluginSlug === ResolutionCollectionLookup.SYSTEM_OWNER || activePlugins.has(entry.pluginSlug);
  }

  /**
   * The collection this contract names, owned by the SAME plugin that declared the contract.
   *
   * Matched on either spelling of the collection's name (`shortSlug` is how a plugin writes it;
   * `slug` is how it is registered), because a contract may legitimately be written either way.
   */
  static forContract(
    contract: IResolvedPluginDefaultPageContract,
    collections: Map<string, IResolutionScanEntry>,
    activePlugins: Set<string>,
  ): IResolutionScanEntry | null {
    const expectedCollection = String(contract.recordCollection || '').trim();
    if (!expectedCollection) {
      return null;
    }

    for (const entry of collections.values()) {
      if (entry.pluginSlug !== contract.pluginSlug) continue;
      if (!ResolutionCollectionLookup.isUsable(entry, activePlugins)) continue;

      const names = [entry.collection.shortSlug, entry.collection.slug]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      if (names.includes(expectedCollection)) {
        return entry;
      }
    }

    return null;
  }

  /** Whichever active owner provides `pages` — the collection a shell contract renders through. */
  static pages(
    collections: Map<string, IResolutionScanEntry>,
    activePlugins: Set<string>,
  ): IResolutionScanEntry | null {
    for (const entry of collections.values()) {
      if (!ResolutionCollectionLookup.isUsable(entry, activePlugins)) continue;
      if ((entry.collection.shortSlug || entry.collection.slug) === 'pages') {
        return entry;
      }
    }

    return null;
  }
}

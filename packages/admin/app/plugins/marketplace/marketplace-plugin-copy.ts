/**
 * A marketplace entry's name and description in the console's language. The catalog carries the
 * publisher's English; an INSTALLED plugin's manifest is already worded from its own dictionary by
 * the api, so a Bulgarian console showed "Финанси" under Installed and "Finance Core" in the store.
 * Use the installed words when there are any; an entry not installed here has only the catalog's.
 */
export class MarketplacePluginCopy {
  static label(plugin: { name?: string }, installed?: { manifest?: { name?: string } } | null): string {
    return installed?.manifest?.name || plugin?.name || '';
  }

  static description(plugin: { description?: string }, installed?: { manifest?: { description?: string } } | null): string {
    return installed?.manifest?.description || plugin?.description || '';
  }
}

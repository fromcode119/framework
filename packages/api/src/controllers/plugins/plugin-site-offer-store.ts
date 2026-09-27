import { SystemConstants } from '@fromcode119/core';

/**
 * Which installed plugins the platform OFFERS to sites: one `_system_meta` row in the platform partition,
 * a list of slugs. A site may switch an offered plugin on or off for itself; every other plugin stays the
 * platform's to assign.
 *
 * Its only control is the "Offered to sites" switch on each plugin (Platform scope) — never a JSON field in
 * Settings — which is why it is its own row here and not a declared system setting.
 */
export class PluginSiteOfferStore {
  static readonly KEY = 'plugins:offered_to_sites';

  constructor(private readonly db: any) {}

  /** The offered slugs. A row that cannot be read offers nothing, rather than everything. */
  list(): Promise<string[]> {
    return this.db.withPlatformAdmin(() => this.read());
  }

  /** Offers `slug` to sites, or stops offering it; answers the list as it now is. */
  set(slug: string, offered: boolean): Promise<string[]> {
    return this.db.withPlatformAdmin(async () => {
      const current = await this.read();
      const next = offered ? [...new Set([...current, slug])].sort() : current.filter((entry) => entry !== slug);
      const value = JSON.stringify(next);
      // findOne -> insert/update, as every writer of this table does: `upsert` needs a table OBJECT.
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: PluginSiteOfferStore.KEY });
      if (existing) await this.db.update(SystemConstants.TABLE.META, { key: PluginSiteOfferStore.KEY }, { value });
      else await this.db.insert(SystemConstants.TABLE.META, { key: PluginSiteOfferStore.KEY, value });
      return next;
    });
  }

  private async read(): Promise<string[]> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: PluginSiteOfferStore.KEY });
    try {
      const parsed = JSON.parse(String(row?.value ?? '[]'));
      return Array.isArray(parsed) ? parsed.map((slug) => String(slug)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
}

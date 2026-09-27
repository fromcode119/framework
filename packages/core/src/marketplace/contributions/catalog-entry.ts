import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import { CatalogSource } from '@core/marketplace/enums/catalog-source.enum';

/**
 * One installable version offered by something other than the remote marketplace.
 *
 * The Plugins screen has always answered "is there a newer version" by comparing what is installed
 * against the marketplace catalogue. An installation with no marketplace therefore never had an
 * answer — the counter read "0 updates" whether or not anything newer existed, which is the least
 * useful of the three possible answers.
 *
 * A contributed entry is the same shape the catalogue already speaks, so nothing downstream learns a
 * new concept: the counter, the badge and the update action work unchanged.
 */
export class CatalogEntry {
  constructor(
    readonly slug: string,
    readonly version: string,
    readonly kind: string,
    readonly downloadUrl: string,
    /** What changed in this version, in the words of whoever wrote the release. May be empty. */
    readonly notes: string,
    readonly name: string,
  ) {}

  static from(row: Record<string, unknown>): CatalogEntry | null {
    const slug = String(row?.slug || '').trim();
    const version = String(row?.version || '').trim();
    // The catalogue predates themes, so a row that states no kind is a plugin. A kind it DOES state
    // but nothing here can install is not offered at all, rather than guessed as a plugin.
    const stated = String(row?.kind ?? '').trim();
    const kind = stated ? ExtensionScope.find(stated) : ExtensionScope.PLUGIN;
    if (!slug || !version || !kind) return null;

    return new CatalogEntry(
      slug,
      version,
      kind.value,
      String(row?.downloadUrl || '').trim(),
      String(row?.notes || '').trim(),
      String(row?.name || slug).trim(),
    );
  }

  /**
   * The catalogue's own shape, so a contributed entry travels through the same code as a remote one
   * — except for `source`, which is the one thing that must NOT be indistinguishable. The screen has
   * to be able to say that this came off our own build server and not from a catalogue.
   */
  toCatalogPlugin(): Record<string, unknown> {
    return {
      slug: this.slug,
      name: this.name,
      version: this.version,
      kind: this.kind,
      downloadUrl: this.downloadUrl,
      releaseNotes: this.notes,
      source: CatalogSource.LOCAL.value,
    };
  }
}

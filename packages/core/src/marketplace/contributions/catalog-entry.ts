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
    if (!slug || !version) return null;

    return new CatalogEntry(
      slug,
      version,
      String(row?.kind || 'plugin').trim(),
      String(row?.downloadUrl || '').trim(),
      String(row?.notes || '').trim(),
      String(row?.name || slug).trim(),
    );
  }

  /** The catalogue's own shape, so a contributed entry is indistinguishable downstream. */
  toCatalogPlugin(): Record<string, unknown> {
    return {
      slug: this.slug,
      name: this.name,
      version: this.version,
      kind: this.kind,
      downloadUrl: this.downloadUrl,
      releaseNotes: this.notes,
      source: 'local',
    };
  }
}

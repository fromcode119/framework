/**
 * Refuses a downloaded package that is not what the marketplace offered.
 *
 * A catalogue entry's slug and version are typed separately from the package file it points at, so
 * they can disagree. Installing anyway put a different version (or a different extension) in place
 * than the one the operator chose, and an entry saying 1.0.1 over a package saying 1.0.0 kept
 * offering the same update forever.
 */
export class MarketplaceOfferMatch {
  static assert(kind: string, offered: { slug: string; version?: string }, manifest: { slug?: string; version?: string }): void {
    const offeredVersion = String(offered.version ?? '').trim();
    const slugMatches = String(manifest.slug ?? '') === offered.slug;
    const versionMatches = !offeredVersion || String(manifest.version ?? '') === offeredVersion;
    if (slugMatches && versionMatches) return;
    throw new Error(
      `The ${kind} package is "${manifest.slug ?? '?'}" ${manifest.version ?? '?'}, but the marketplace offered `
      + `"${offered.slug}" ${offeredVersion || '(any version)'}. Nothing was installed.`,
    );
  }
}

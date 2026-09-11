import type { IBuildSourceSummary } from '@sources/sources/interfaces/build-source-summary.interface';

/**
 * What Sources offers the admin's catalogue.
 *
 * The Plugins screen has always answered "is there an update" by comparing what is installed against
 * the marketplace catalogue, so an installation with no marketplace read "0 updates" whether or not
 * anything newer existed. Every successfully built source is a version this installation HAS, so it
 * belongs in that catalogue — and then the counter, the badge and the update action all work without
 * anyone visiting this screen.
 *
 * Only successful builds are offered: a source that failed has no artifact, and offering its version
 * would advertise an update that cannot be installed.
 */
export class CatalogContributionService {
  static entriesFrom(sources: IBuildSourceSummary[]): Array<Record<string, unknown>> {
    return sources
      .filter((source) => source.lastBuildStatus === 'success' && String(source.version || '').trim() !== '')
      .map((source) => ({
        slug: source.slug,
        name: source.slug,
        version: String(source.version),
        kind: String(source.type),
        // Resolved by the installer against this plugin's own download route; the file lives here.
        downloadUrl: String(source.fileName || ''),
        // What changed, in the words of whoever wrote the commits. Empty when there is no previous
        // revision to compare against — never a stand-in sentence.
        notes: String(source.changelog || ''),
      }));
  }
}

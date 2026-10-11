import * as fs from 'fs';
import type { ExtensionScope } from '@fromcode119/core';
import type { PackageBuilder } from '@sources/packaging/package-builder';

/**
 * Keeps the newest few staged versions of each extension and removes the rest, after every build.
 *
 * Every build stages a whole package directory, and nothing removed them: one theme's 46 versions at
 * 258 MB each held 12 GB of a production disk. A version that goes is not lost — it is rebuilt from
 * its source. How many stay is the platform setting Settings → General → "Builds kept per extension";
 * with no valid number there nothing is removed. The version just built always stays, and a site
 * never runs from here (an install copies the package), so removing one touches no running site.
 */
export class StagedVersionPruner {
  constructor(
    private readonly packageBuilder: PackageBuilder,
    private readonly keep: () => Promise<number | null>,
    private readonly log: (message: string) => void,
  ) {}

  /** Returns the versions it removed. */
  async prune(type: ExtensionScope, slug: string, builtVersion: string): Promise<string[]> {
    const keep = await this.keep();
    if (keep === null || !Number.isInteger(keep) || keep < 1) return [];
    const versions = this.packageBuilder.listStagedVersions(type, slug);
    const kept = new Set([...versions.slice(0, keep), builtVersion]);
    const removed: string[] = [];
    for (const version of versions) {
      if (kept.has(version)) continue;
      fs.rmSync(this.packageBuilder.stagingDirFor(type, slug, version), { recursive: true, force: true });
      removed.push(version);
    }
    if (removed.length) this.log(`Removed ${removed.length} older build(s) of ${slug}, keeping the newest ${keep}: ${removed.join(', ')}.`);
    return removed;
  }
}

/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { SourceTree } from './source-tree';
import { FrameworkRoot } from './cli/framework-root';

/**
 * The framework names no extension — enforced, not asked for.
 *
 * A slug inside `packages/**` makes the framework know about a product built on it, and it has gone
 * wrong repeatedly: a table name in a doc comment, a fixture, a seeded setting value. Three earlier
 * attempts at a guard were abandoned, and the reason is worth writing down, because it is what shapes
 * this one: extension slugs are ORDINARY ENGLISH. `hub`, `search`, `forms`, `cms`, `marketplace`,
 * `licensing` — scanning for those words produces almost nothing but false positives, and a guard
 * that cries wolf is turned off within a day.
 *
 * So it scans for STRUCTURE instead, the shapes a slug can only have when it is being used AS a slug:
 *
 *  - `fcp_<slug>_…` — an extension's physical table name.
 *  - `<slug>Api` — the global a plugin exposes its domain API under.
 *  - `api/v<n>/plugins/<slug>` — a versioned endpoint reaching into one specific extension, which the
 *    conventions forbid outright.
 *
 * A bare `plugins/<slug>/` is deliberately NOT one of them: the admin's own route tree lives at
 * `app/plugins/…`, and one of its pages is the plugin marketplace — so that shape matches the
 * framework's own directory whenever an extension happens to share a name with a framework feature.
 * Twelve such matches came out of a first run, none of them a reference to the extension.
 *
 * None of those can occur by accident in prose, and all three are exactly how the framework has
 * actually named an extension in the past.
 *
 * MIGRATIONS ARE EXEMPT, and this is not a loophole. A migration that renamed a plugin's table reads
 * the OLD name to find the rows — `copyRows(db, 'fcp_<slug>_redirects', …)` — and that literal is the
 * only thing that can still locate them. Renaming it does not clean anything up; it destroys the
 * migration. The same reasoning the naming rules already give for a legacy key map.
 *
 * The slugs are DISCOVERED from the extension directories, never listed here. A list in the framework
 * naming every extension would be the very thing this forbids.
 */
export class ExtensionNameGuard {
  /** Where an extension's name is load-bearing history rather than a reference. */
  private static readonly EXEMPT = /[\\/]database[\\/]migrations[\\/]/;

  /** Slugs read off disk, so a new extension is covered the moment it exists. */
  private static slugs(): string[] {
    const repo = FrameworkRoot.repo();
    const found = new Set<string>();

    for (const area of ['plugins', 'themes', 'appearance']) {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(path.join(repo, area), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) found.add(entry.name);
      }
    }

    return [...found];
  }

  /** The shapes a slug can only take when it is being used as one. */
  private static patterns(slug: string): RegExp[] {
    const escaped = slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const camel = escaped.replace(/-([a-z])/g, (_full, letter: string) => letter.toUpperCase());
    return [
      new RegExp(`fcp_${escaped.replace(/-/g, '_')}_`),
      new RegExp(`\\b${camel}Api\\b`),
      new RegExp(`api/v\\d+/plugins/${escaped}\\b`),
    ];
  }

  static run(): number {
    const slugs = ExtensionNameGuard.slugs();
    if (!slugs.length) {
      console.log('No extension directories beside the framework; nothing to check against.');
      return 0;
    }

    const checks = slugs.map((slug) => ({ slug, patterns: ExtensionNameGuard.patterns(slug) }));
    const framework = SourceTree.areas().filter((area) => area.area === 'framework');
    const findings: string[] = [];
    let scanned = 0;

    for (const { dir } of framework) {
      for (const file of SourceTree.files(dir, (name) => /\.tsx?$/.test(name))) {
        if (ExtensionNameGuard.EXEMPT.test(file)) continue;
        scanned++;

        const lines = SourceTree.lines(file);
        lines.forEach((line, index) => {
          for (const { slug, patterns } of checks) {
            if (!patterns.some((pattern) => pattern.test(line))) continue;
            findings.push(`  ${SourceTree.cite(file)}:${index + 1}  names "${slug}"\n    ${line.trim().slice(0, 110)}`);
            return;
          }
        });
      }
    }

    console.log(`Framework files scanned: ${scanned}, against ${slugs.length} extension slug(s) found on disk.`);
    if (!findings.length) {
      console.log('OK — the framework names no extension.');
      return 0;
    }

    console.log(`\n${findings.length} place(s) where framework code names an extension:\n`);
    for (const finding of findings) console.log(finding);
    console.log('\nThe framework must not know which products are built on it. Use a neutral name in a');
    console.log('comment or fixture; reach for a registry where the value is real.');
    return 1;
  }
}

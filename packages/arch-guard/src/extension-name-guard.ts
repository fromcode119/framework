/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { SourceTree } from './source-tree';
import { FrameworkRoot } from './cli/framework-root';
import { DistinctiveNameScan } from './distinctive-name-scan';

/**
 * The framework names no extension — enforced, not asked for.
 *
 * A slug inside `packages/**` makes the framework know about a product built on it, and it has gone
 * wrong repeatedly: a table name in a doc comment, a fixture, a seeded setting value. Three earlier
 * attempts at a guard were abandoned, and the reason is worth writing down, because it is what shapes
 * this one: extension slugs are ORDINARY ENGLISH. `hub`, `search`, `forms`, `marketplace` — words
 * the framework uses for its own features — scanning for those produces almost nothing but false
 * positives, and a guard that cries wolf is turned off within a day.
 *
 * So it scans for STRUCTURE instead, the shapes a slug can only have when it is being used AS a slug:
 *
 *  - `fcp_<slug>_…` — an extension's physical table name.
 *  - `<slug>Api` / `<Slug>Api…` — the global a plugin exposes its domain API under, and the prefix of
 *    the error and client types that go with it (`<Slug>ApiError`). Bounded to the `Api` suffix on
 *    purpose: a bare `<Slug>[A-Z]` also matches the framework's OWN features, because the admin has a
 *    marketplace page and there is a marketplace plugin — that shape reported 273 places, nearly all
 *    of them the admin's own components.
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
 *
 * ONE MORE TIER checks PROSE, which the shapes above never see: a bare word that is a DISTINCTIVE
 * name — not an English word — anywhere in a framework file, comment and test fixture included. Those
 * names are held as hashes by {@link DistinctiveNameScan}, which says why. It does not depend on what
 * is checked out beside the framework, so unlike the shapes it holds in the framework's own CI.
 *
 * IT ALSO CHECKS THE EXTENSIONS, for the neighbouring rule: an extension may name ITSELF, and must not
 * name another. That is the same fault one layer out — a theme reaching into a plugin's domain API, a
 * plugin hardcoding a sibling's table. It REPORTS there rather than failing, because the framework is
 * at zero and the extensions are not (~75 places today), and a guard that fails on somebody else's
 * backlog is a guard that gets switched off. The framework half gates.
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
      new RegExp(`\\b(?:${camel}|${camel.charAt(0).toUpperCase() + camel.slice(1)})Api`),
      new RegExp(`api/v\\d+/plugins/${escaped}\\b`),
    ];
  }

  /** Places in `dir` that name a slug other than `self`. */
  private static findingsIn(dir: string, checks: Array<{ slug: string; patterns: RegExp[] }>, self: string | null): string[] {
    const findings: string[] = [];

    for (const file of SourceTree.files(dir, (name) => /\.tsx?$/.test(name))) {
      if (ExtensionNameGuard.EXEMPT.test(file)) continue;

      SourceTree.lines(file).forEach((line, index) => {
        for (const { slug, patterns } of checks) {
          if (slug === self) continue;
          if (!patterns.some((pattern) => pattern.test(line))) continue;
          findings.push(`  ${SourceTree.cite(file)}:${index + 1}  names "${slug}"\n    ${line.trim().slice(0, 110)}`);
          return;
        }
      });
    }

    return findings;
  }

  /** Each extension directory, with the slug it is allowed to name: its own. */
  private static extensionDirs(): Array<{ dir: string; self: string }> {
    const repo = FrameworkRoot.repo();
    const found: Array<{ dir: string; self: string }> = [];

    for (const area of ['plugins', 'themes', 'appearance']) {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(path.join(repo, area), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) found.push({ dir: path.join(repo, area, entry.name), self: entry.name });
      }
    }

    return found;
  }

  /**
   * Slugs the FRAMEWORK also uses as its own name, derived rather than listed.
   *
   * Some extensions are named after concepts the framework had first. It declares `class
   * PluginManager…` and ships a marketplace client package, and there are extensions with matching
   * slugs — so `PluginManagerApi` and `MarketplaceApiSuffix` are the framework talking about ITSELF,
   * not reaching for an extension. Nine of twelve findings in a first run were exactly that.
   *
   * The signal is a class the framework DECLARES whose name starts with the slug. Being the thing is
   * different from referencing it, and a declaration is the difference written down. Only the `…Api`
   * shape is forgiven this way: a `fcp_<slug>_` table or a versioned plugin route is never the
   * framework's own, whatever it happens to be called.
   */
  private static frameworkOwned(slugs: string[]): Set<string> {
    const declared = new Set<string>();

    for (const { dir } of SourceTree.areas().filter((area) => area.area === 'framework')) {
      for (const file of SourceTree.files(dir, (name) => /\.tsx?$/.test(name))) {
        for (const match of SourceTree.lines(file).join('\n').matchAll(/\b(?:class|interface)\s+([A-Z][A-Za-z0-9]*)/g)) {
          declared.add(match[1]!);
        }
      }
    }

    const owned = new Set<string>();
    for (const slug of slugs) {
      const camel = slug.replace(/-([a-z])/g, (_full, letter: string) => letter.toUpperCase());
      const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
      if ([...declared].some((name) => name.startsWith(pascal))) owned.add(slug);
    }
    return owned;
  }

  /** Files the prose tier reads: source, and the config and styles that ship beside it. */
  private static readonly NAMED_FILES = /\.(?:tsx?|[cm]?js|json|css|less)$/;

  static run(): number {
    const slugs = ExtensionNameGuard.slugs();
    const owned = ExtensionNameGuard.frameworkOwned(slugs);
    const checks = slugs.map((slug) => ({
      slug,
      // A slug the framework also names itself keeps the unambiguous shapes and drops the `…Api` one.
      patterns: ExtensionNameGuard.patterns(slug).filter((pattern, at) => !(owned.has(slug) && at === 1)),
    }));
    const framework = SourceTree.areas().filter((area) => area.area === 'framework');
    const names = new DistinctiveNameScan();
    const findings: string[] = [];
    let scanned = 0;

    for (const { dir } of framework) {
      for (const file of SourceTree.files(dir, (name) => ExtensionNameGuard.NAMED_FILES.test(name))) {
        if (ExtensionNameGuard.EXEMPT.test(file)) continue;
        scanned++;
        const shaped = /\.tsx?$/.test(file);

        SourceTree.lines(file).forEach((line, index) => {
          const cite = `  ${SourceTree.cite(file)}:${index + 1}`;
          const body = `\n    ${line.trim().slice(0, 110)}`;
          for (const { slug, patterns } of shaped ? checks : []) {
            if (!patterns.some((pattern) => pattern.test(line))) continue;
            findings.push(`${cite}  names "${slug}"${body}`);
            return;
          }
          const word = names.match(line);
          if (word) findings.push(`${cite}  names "${word}"${body}`);
        });
      }
    }

    console.log(slugs.length
      ? `Framework files scanned: ${scanned}, against ${slugs.length} extension slug(s) found on disk and the distinctive names.`
      : `Framework files scanned: ${scanned}, against the distinctive names only — no extension directory beside the framework, so the slug shapes had nothing to match.`);

    const crossed = ExtensionNameGuard.extensionDirs()
      .flatMap(({ dir, self }) => ExtensionNameGuard.findingsIn(dir, checks, self));
    if (crossed.length) {
      console.log(`\n${crossed.length} place(s) where an extension names ANOTHER extension (reported, not enforced):`);
      for (const finding of crossed.slice(0, 5)) console.log(finding);
      if (crossed.length > 5) console.log(`  … and ${crossed.length - 5} more`);
      console.log('  Cross-extension coupling goes through the namespace API or a registry, never a literal.');
    }

    if (!findings.length) {
      console.log('\nOK — the framework names no extension.');
      return 0;
    }

    console.log(`\n${findings.length} place(s) where FRAMEWORK code names an extension:\n`);
    for (const finding of findings) console.log(finding);
    console.log('\nThe framework must not know which products are built on it. Use a neutral name in a');
    console.log('comment or fixture; reach for a registry where the value is real.');
    return 1;
  }
}

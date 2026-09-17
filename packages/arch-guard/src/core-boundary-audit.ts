/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';

/**
 * The framework must not name a plugin: no `@fromcode119/plugin-x` import, no reach into a plugin's
 * own module paths. Cross-plugin and core->plugin coupling goes through the namespace API or a
 * registry, never a literal.
 *
 * WHAT IT LOOKS AT, and why that is narrower than it was: this began as a verbatim port that tested
 * every LINE against the plugin slugs, and the slugs are ordinary words. `search`, `hub` and
 * `marketplace` are plugins AND framework concepts, so it reported the framework's own
 * `AdminSearchService`, the `marketplace_url` settings key that lives in `SystemConstants.META_KEY`,
 * and English prose in comments ("folder/search view") as plugin coupling. Dozens of findings, none
 * of them coupling — which is why it was never in the build and why nobody acted on it.
 *
 * A reference to a plugin can only arrive through a MODULE SPECIFIER, so that is all this reads now:
 * the quoted path of an `import`/`export … from`, `require(…)` or dynamic `import(…)`. A word in a
 * comment cannot import anything, and a framework identifier that happens to share a noun with a
 * plugin is not a dependency on it.
 */
export class CoreBoundaryAudit {
  /** Run the check; returns the process exit code (0 = clean). */
  static run(): number {

    const ROOT = process.cwd();
    const SOURCE_DIRS = [
      path.join(ROOT, 'packages', 'api', 'src'),
      path.join(ROOT, 'packages', 'admin', 'app'),
      path.join(ROOT, 'packages', 'admin', 'components'),
      path.join(ROOT, 'packages', 'admin', 'lib'),
      path.join(ROOT, 'packages', 'sdk', 'src')
    ];

    const ALLOWED_PATH_MATCHERS = [
      /\/packages\/admin\/app\/plugins\//,
      /\/packages\/admin\/app\/themes\//
    ];

    function escapeRegex(value) {
      return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function normalizeToken(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '')
        .replace(/^fromcode[-_/]*/i, '')
        .replace(/^plugin[-_/]*/i, '')
        .replace(/^theme[-_/]*/i, '');
    }

    function readJson(filePath) {
      try {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return null;
      }
    }

    function collectPluginTokens() {
      const roots = [
        process.env.PLUGINS_DIR,
        path.resolve(ROOT, '..', '..', 'plugins')
      ].filter(Boolean);

      const tokens = new Set<any>();

      for (const pluginsRoot of roots as string[]) {
        if (!fs.existsSync(pluginsRoot)) continue;
        const entries = fs.readdirSync(pluginsRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dir = path.join(pluginsRoot, entry.name);
          const manifest = readJson(path.join(dir, 'manifest.json'));
          const pkg = readJson(path.join(dir, 'package.json'));
          const candidates = [
            manifest?.slug,
            pkg?.name
          ];
          for (const candidate of candidates) {
            const token = normalizeToken(candidate);
            if (!token || token.length < 2) continue;
            tokens.add(token);
          }
        }
      }

      return Array.from(tokens);
    }

    /**
     * A specifier the framework resolves WITHIN ITSELF. `@api/services/admin-search-service` is the
     * framework's own service; that it contains the word "search", which is also a plugin, makes it
     * no less the framework's own. Fuzzy-matching slugs as substrings reported all of these, which is
     * how a guard ends up with dozens of findings nobody can act on.
     */
    function isFrameworkInternal(specifier: string): boolean {
      if (/^[.]{1,2}\//.test(specifier)) return !specifier.includes('/plugins/');
      return /^@(?:\/|api\/|core\/|admin\/|database\/|sdk\/|mcp\/|sources\/|frontend\/)/.test(specifier)
        || /^@fromcode119\/(?!plugin-)/.test(specifier)
        || !specifier.startsWith('@') && !specifier.includes('/');
    }

    /**
     * Does this module specifier name a PLUGIN? Exact, not fuzzy: a plugin is referenced by its own
     * package name, by its `@plugin/` alias, or by a path through `plugins/<slug>/`. A slug appearing
     * as a WORD inside a framework path is not a reference to the plugin — it is a word.
     */
    function referencesPlugin(specifier: string, tokens: string[]): boolean {
      if (isFrameworkInternal(specifier)) return false;
      if (specifier.startsWith('@plugin/')) return true;
      const viaPath = specifier.match(/(?:^|\/)plugins\/([a-z0-9-]+)/i);
      if (viaPath) return tokens.includes(normalizeToken(viaPath[1]));
      return tokens.some((token) => {
        const escaped = escapeRegex(token);
        return new RegExp(`^@fromcode119/plugin-${escaped}(?:/|$)`, 'i').test(specifier)
          || new RegExp(`^(?:@[a-z0-9-]+/)?(?:plugin-)?${escaped}(?:/|$)`, 'i').test(specifier);
      });
    }

    function walk(dir: any, out: any[] = []) {
      if (!fs.existsSync(dir)) return out;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') {
            continue;
          }
          walk(full, out);
          continue;
        }
        if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
        if (/\.(test|spec)\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
        out.push(full);
      }
      return out;
    }

    /**
     * The quoted module paths on one line — the only way a file can reference another package.
     *
     * Matching the SPECIFIER rather than the line is the whole point: `import … from '@plugin/x'`
     * is coupling, while `// see the folder/search view` is a sentence.
     */
    function moduleSpecifiers(line: string): string[] {
      const found: string[] = [];
      const from = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;
      for (const match of line.matchAll(from)) found.push(match[1] as string);
      return found;
    }

    function isAllowedPath(filePath) {
      return ALLOWED_PATH_MATCHERS.some((matcher) => matcher.test(filePath));
    }

    const findings: any[] = [];
    const pluginTokens = collectPluginTokens();
    const tokenList = pluginTokens as string[];
    for (const sourceDir of SOURCE_DIRS) {
      for (const filePath of walk(sourceDir)) {
        if (isAllowedPath(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          for (const specifier of moduleSpecifiers(line)) {
            if (!referencesPlugin(specifier, tokenList)) continue;
            findings.push({
              file: path.relative(ROOT, filePath),
              line: index + 1,
              text: line.trim()
            });
            return;
          }
        });
      }
    }

    if (findings.length) {
      console.error('[core-boundary] Plugin-specific terms found in framework core files:');
      for (const finding of findings) {
        console.error(`- ${finding.file}:${finding.line} -> ${finding.text}`);
      }
      return 1;
    }

    console.log('[core-boundary] OK: no plugin-specific coupling found in api/admin/sdk core sources.');

    return 0;
  }
}

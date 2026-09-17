import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * `class X extends A, B` may not appear in a FRAMEWORK package's source.
 *
 * The extended `extends` clause is typor's, and three toolchains rewrite it before anything runs it:
 * a webpack loader for the Next apps, an esbuild plugin for the plugin/theme/appearance bundles, and
 * `typor build` for a package's own emit. There is a FOURTH runtime, and it cannot be taught:
 * `packages/api`'s dev server is `tsx watch`, and the root tsconfig's paths resolve
 * `@fromcode119/core` to `packages/core/src` — so every framework package is loaded as SOURCE and
 * handed straight to esbuild, which cannot parse the clause.
 *
 * The cost was not subtle. `PluginManager extends PluginManagerExtensions, PluginManagerApi` killed
 * the local api at boot with `Expected "{" but found ","`, and the whole local stack — the loop this
 * repository tells everyone to work in — could not be started.
 *
 * It was not fixable from outside. A Node `load` hook cannot hand tsx rewritten source: tsx ignores
 * `context.source` and re-reads from disk (measured), and a hook that short-circuits instead has to
 * emit the final module itself, which drops the file out of tsx's own resolution — its relative
 * imports then fail. Both were tried.
 *
 * SO: extensions use it, the framework does not. A linear chain (`A extends B extends C`) costs
 * nothing here — the framework's other ~30 split classes are chains — and it runs everywhere.
 */
export class ExtendedExtendsGuard {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git',
  ]);

  /** The head of a class declaration, from `extends` up to its opening brace. */
  private static readonly CLASS_HEAD = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+\s+extends\s+([^{]*)/gm;

  /**
   * Does this heritage list name more than one base?
   *
   * The comma has to be found at the TOP level: `extends Bridge<IValues, IProps>` is ONE base with two
   * type arguments, and counting its comma reported eleven perfectly ordinary components as offenders.
   */
  private static namesTwoBases(heritage: string): boolean {
    let depth = 0;
    for (const character of heritage) {
      if (character === '<' || character === '(' || character === '[') depth += 1;
      else if (character === '>' || character === ')' || character === ']') depth -= 1;
      else if (character === ',' && depth === 0) return true;
    }
    return false;
  }

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        if (!ExtendedExtendsGuard.SKIP_DIR.has(entry)) ExtendedExtendsGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /**
   * Every framework file using the extended clause.
   *
   * Only the `framework` area is scanned: an extension's own build applies the esbuild plugin, so the
   * clause is legitimate there and this guard has nothing to say about it.
   */
  static scan(roots: readonly { area: string; dir: string }[]): Array<{ file: string; lines: string[] }> {
    const offenders: Array<{ file: string; lines: string[] }> = [];
    for (const { area, dir } of roots) {
      if (area !== 'framework') continue;
      for (const file of ExtendedExtendsGuard.files(dir)) {
        let source: string;
        try { source = readFileSync(file, 'utf8'); } catch { continue; }
        ExtendedExtendsGuard.CLASS_HEAD.lastIndex = 0;
        const lines: string[] = [];
        for (const match of source.matchAll(ExtendedExtendsGuard.CLASS_HEAD)) {
          // `implements` starts a DIFFERENT list, whose commas are not extra bases.
          const heritage = (match[1] ?? '').split(/\bimplements\b/)[0];
          if (ExtendedExtendsGuard.namesTwoBases(heritage)) lines.push(match[0].trim());
        }
        if (lines.length) offenders.push({ file, lines });
      }
    }
    return offenders;
  }
}

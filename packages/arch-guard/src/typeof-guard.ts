import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Hand-rolled `typeof x === 'string' | 'number' | 'boolean' | 'function' | 'object'` checks.
 *
 * Two things wear this shape and both are wrong:
 *  - Defending against a framework contract (`typeof context.auth?.guard === 'function' ? … : denied`).
 *    The contract is guaranteed, so the false branch is dead code that hides a real failure.
 *  - Coercing untrusted input (`typeof r?.slug === 'string' ? r.slug.trim() : ''`). That is what the SDK
 *    coercion utilities are for: `CoercionUtils.toString / toNumber / toBoolean / toObject`, which handle
 *    every shape and read as one expression instead of a ternary.
 *
 * NOT flagged: `typeof x === 'undefined'` and `typeof x !== 'undefined'`. Those are existence checks, not
 * type guards — though in browser code `Platform.isBrowser` / `Platform.hasWindow` is still preferred.
 *
 * Ratcheted per area: the count may fall, never rise.
 */
export class TypeofGuard {
  /** `typeof … === '<primitive>'` in either direction. `undefined` is intentionally absent. */
  /**
   * The shapes the convention actually bans: `typeof x === 'string' | 'number' | 'boolean' |
   * 'function'`. Those have a home — `CoercionUtils.toString/toNumber/toBoolean` for untrusted input,
   * and for a framework contract nothing at all, because the contract is guaranteed and the guard is
   * a dead branch.
   *
   * `'object'` and `'symbol'` are NOT in that list, and used to be. They are how TypeScript narrows an
   * `unknown` — `typeof parsed === 'object'` before reading a parsed JSON body, `typeof error !==
   * 'object'` in a catch. There is no `CoercionUtils.toObject` to reach for and no contract being
   * defended; the check IS the narrowing. Counting them made the guard report 491 findings with no
   * available fix, which is how a guard becomes noise.
   */
  private static readonly PATTERN =
    /typeof\s+[^=!\n]+?\s*[=!]==?\s*['"](?:string|number|boolean|function)['"]/g;

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /**
   * `reactor` / `next-build-codegen` / `typescript-multiple-inheritance` / `arch-guard` are the standalone layer that confines raw JS/TS mechanics —
   * a runtime type check is sometimes genuinely their job, and they cannot import the SDK to avoid it.
   */
  private static readonly EXEMPT_PACKAGES = new Set(['react-class-components', 'next-build-codegen', 'typescript-multiple-inheritance', 'arch-guard']);



  /**
   * `ui` / `ui-ssr` are BUILD OUTPUT at a plugin or theme ROOT, but `src/ui` is SOURCE. Excluding the
   * directory by NAME skips every plugin's UI source — the exact mistake that made this guard silently
   * scan nothing. Skip by PATH: only when it is not under a `src/`.
   */
  private static isBuildOutput(full: string): boolean {
    const p = full.replace(/\\/g, '/');
    return /\/(ui|ui-ssr)$/.test(p) && !p.includes('/src/');
  }

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let isDir = false;
      try { isDir = statSync(full).isDirectory(); } catch { continue; }
      if (isDir) {
        if (TypeofGuard.SKIP_DIR.has(entry) || TypeofGuard.EXEMPT_PACKAGES.has(entry) || TypeofGuard.isBuildOutput(full)) continue;
        TypeofGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  static violationsIn(file: string): string[] {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return []; }
    if (!source.includes('typeof')) return [];
    const hits: string[] = [];
    source.split('\n').forEach((line, index) => {
      // A commented-out example is documentation, not code.
      if (/^\s*(\*|\/\/)/.test(line)) return;
      TypeofGuard.PATTERN.lastIndex = 0;
      const matches = line.match(TypeofGuard.PATTERN);
      if (matches) for (const match of matches) hits.push(`${index + 1}: ${match.trim().slice(0, 70)}`);
    });
    return hits;
  }

  static scan(roots: readonly { area: string; dir: string }[]): {
    counts: Record<string, number>;
    detail: { area: string; file: string; hits: string[] }[];
  } {
    const counts: Record<string, number> = {};
    const detail: { area: string; file: string; hits: string[] }[] = [];
    for (const { area, dir } of roots) {
      counts[area] = counts[area] ?? 0;
      for (const file of TypeofGuard.files(dir)) {
        const hits = TypeofGuard.violationsIn(file);
        if (!hits.length) continue;
        counts[area] += hits.length;
        detail.push({ area, file, hits });
      }
    }
    return { counts, detail };
  }
}

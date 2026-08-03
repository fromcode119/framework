import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * "Only `export class`, nothing else" — the three shapes that still violate it, ratcheted per area.
 *
 *  - `inlineUnion`  — a string union written inline (`'page' | 'url'`, `'bold' | 'italic' | …`). A union
 *                     cannot be enumerated, carries no behaviour, and a typo in a comparison is a branch
 *                     that never runs instead of a compile error. Use a reactor `Enum`.
 *  - `typesFile`    — a `*.types.ts` bag. A data shape is a class; a behavioural contract is an
 *                     `interface` in its own `*.interface.ts`.
 *  - `moduleFn`     — a module-level `function`. Behaviour belongs on a class as a (static) method.
 *
 * Counts may FALL, never rise. Lower a baseline when you convert; never raise one to make a build pass.
 */
export class ClassOnlyGuard {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /** These packages ARE the layer that confines non-class JS mechanics (decorators, tags, build glue). */
  private static readonly EXEMPT_PACKAGES = new Set(['reactor', 'nextor', 'typor', 'archor']);

  /** Two or more quoted lowercase-ish members joined by `|` — an inline enum in all but name. */
  private static readonly INLINE_UNION = /'[a-z0-9_-]+'\s*\|\s*'[a-z0-9_-]+'/g;

  /** A `function` at column 0 — i.e. not a method, not nested. */
  private static readonly MODULE_FN = /^(export\s+)?(async\s+)?function\s+/;

  static readonly BASELINE: Readonly<Record<string, Record<string, number>>> = {
    inlineUnion: { plugins: 457, themes: 42, framework: 35, appearance: 15 },
    typesFile: { plugins: 70, themes: 0, framework: 0, appearance: 0 },
    moduleFn: { plugins: 16, themes: 0, framework: 0, appearance: 0 },
  };

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
        if (ClassOnlyGuard.SKIP_DIR.has(entry) || ClassOnlyGuard.EXEMPT_PACKAGES.has(entry)) continue;
        if (ClassOnlyGuard.isBuildOutput(full)) continue;
        ClassOnlyGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /** `{ inlineUnion, typesFile, moduleFn }` counts for one file. */
  private static countIn(file: string): Record<string, number> {
    const counts = { inlineUnion: 0, typesFile: 0, moduleFn: 0 };
    if (/\.types\.ts$/.test(file)) counts.typesFile += 1;
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return counts; }
    // Track template-literal depth by counting unescaped backticks. Generated-script builders emit whole
    // programs inside a template — `analytics-tracker-builder.ts` contains `function getDeviceContext(){`
    // as EMITTED BROWSER TEXT, not as a module function. Counting it made the number untrustworthy, and a
    // ratchet nobody trusts is a ratchet nobody drives down.
    let inTemplate = false;
    for (const line of source.split('\n')) {
      const ticks = (line.match(/(^|[^\\])`/g) ?? []).length;
      const wasInTemplate = inTemplate;
      if (ticks % 2 === 1) inTemplate = !inTemplate;
      if (wasInTemplate) continue;
      if (/^\s*(\*|\/\/)/.test(line)) continue;
      const unions = line.match(ClassOnlyGuard.INLINE_UNION);
      if (unions) counts.inlineUnion += unions.length;
      if (ClassOnlyGuard.MODULE_FN.test(line)) counts.moduleFn += 1;
    }
    return counts;
  }

  static scan(roots: readonly { area: string; dir: string }[]): {
    counts: Record<string, Record<string, number>>;
    detail: { area: string; file: string; counts: Record<string, number> }[];
  } {
    const counts: Record<string, Record<string, number>> = { inlineUnion: {}, typesFile: {}, moduleFn: {} };
    const detail: { area: string; file: string; counts: Record<string, number> }[] = [];
    for (const { area, dir } of roots) {
      for (const bucket of Object.keys(counts)) counts[bucket][area] = counts[bucket][area] ?? 0;
      for (const file of ClassOnlyGuard.files(dir)) {
        const fileCounts = ClassOnlyGuard.countIn(file);
        const total = Object.values(fileCounts).reduce((sum, n) => sum + n, 0);
        if (!total) continue;
        for (const bucket of Object.keys(counts)) counts[bucket][area] += fileCounts[bucket];
        detail.push({ area, file, counts: fileCounts });
      }
    }
    return { counts, detail };
  }
}

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Only a BARREL re-exports someone else's declarations.
 *
 * `export … from '<other module>'` gives a symbol a second import path. Two paths to one type is the
 * same defect this codebase already fights at every other level — one canonical field name, one
 * canonical setting key, one place a rule is declared — and it is worse at module level, because
 * nothing makes the copies disagree loudly. They just drift: one call site imports the type from its
 * own file, another through whatever module happened to re-export it, and moving the declaration
 * breaks only half of them.
 *
 * Caught in the wild: `system-setting-registry.ts`, a CLASS file, re-exported `ISystemSettingDescriptor`
 * and `SystemSettingKey` from the interface files beside it — and `core/src/index.ts` then pulled both
 * through the registry rather than from the files that declare them. Nothing objected, because nothing
 * was looking.
 *
 * WHAT COUNTS AS A BARREL IS DERIVED, NOT LISTED. A barrel is a module the package PUBLISHES: an
 * entry in its own `package.json` `exports` (`core/shared`, `reactor/lang`, `typor/build`), plus
 * `index.ts`, which is the directory-level barrel every tree already uses. The first version of this
 * guard hardcoded `index.ts|client.ts|server.ts` and reported three published entry points as
 * offenders — a name list standing in for a property, which is the mistake this codebase keeps
 * finding in its own code. The package says what it publishes; read that instead.
 */
export class ReExportGuard {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /**
   * `export { X } from '…'` / `export type { X } from '…'` / `export * from '…'`.
   *
   * `export { X }` with no `from` is NOT this: it publishes something the file itself declared, which
   * is the file owning its own surface.
   */
  private static readonly RE_EXPORT = /^export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"][^'"]+['"]/gm;

  /**
   * The source files this package publishes as entry points.
   *
   * `exports` names BUILT paths (`./dist/shared.js`), so each is mapped back to the source beside it.
   * Both `.ts` and `.tsx` are offered because the map cannot say which the author wrote.
   */
  private static publishedEntries(packageDir: string): Set<string> {
    const entries = new Set<string>();
    let manifest: any;
    try {
      manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    } catch {
      return entries;
    }
    const collect = (node: unknown): void => {
      if (typeof node === 'string') {
        const match = /^\.\/dist\/(.+)\.(?:js|cjs|mjs|d\.ts)$/.exec(node);
        if (!match) return;
        for (const extension of ['.ts', '.tsx']) {
          entries.add(path.join(packageDir, 'src', `${match[1]}${extension}`));
        }
        return;
      }
      if (node && typeof node === 'object') for (const value of Object.values(node)) collect(value);
    };
    collect(manifest.exports);
    collect(manifest.main);
    collect(manifest.types);
    return entries;
  }

  /** Every package root under a scanned tree — the directories that own a `package.json`. */
  private static packages(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    if (entries.includes('package.json')) out.push(dir);
    for (const entry of entries) {
      if (ReExportGuard.SKIP_DIR.has(entry)) continue;
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) ReExportGuard.packages(full, out);
    }
    return out;
  }

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        if (!ReExportGuard.SKIP_DIR.has(entry)) ReExportGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && entry !== 'index.ts' && entry !== 'index.tsx') {
        out.push(full);
      }
    }
    return out;
  }

  /** Every non-barrel module that re-exports another module's declarations. */
  static scan(roots: readonly { area: string; dir: string }[]): Array<{ file: string; lines: string[] }> {
    const offenders: Array<{ file: string; lines: string[] }> = [];
    for (const { dir } of roots) {
      for (const packageDir of ReExportGuard.packages(dir)) {
        const published = ReExportGuard.publishedEntries(packageDir);
        for (const file of ReExportGuard.files(packageDir)) {
          if (published.has(file)) continue;
          let source: string;
          try { source = readFileSync(file, 'utf8'); } catch { continue; }
          ReExportGuard.RE_EXPORT.lastIndex = 0;
          const lines = (source.match(ReExportGuard.RE_EXPORT) ?? []).map((line) => line.trim());
          if (lines.length) offenders.push({ file, lines });
        }
      }
    }
    return offenders;
  }
}

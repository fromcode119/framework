import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * The source files a package PUBLISHES as entry points, derived from its own `package.json`.
 *
 * Pulled out of {@link ReExportGuard}, whose docblock already tells the story: the first version of
 * that guard hardcoded `index.ts|client.ts|server.ts` and reported real published entry points as
 * offenders. A package's `exports`/`main`/`types` fields are the actual list of what it publishes;
 * every guard that needs to know "is this file allowed to re-export/re-declare a lot of things
 * because it's a barrel" reads the same property instead of keeping its own name list. Two guards
 * hand-maintaining that list is the exact duplication this codebase's "no scaffolding" rule exists to
 * stop.
 */
export class PublishedEntries {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /**
   * `exports`/`main`/`types` name BUILT paths (`./dist/shared.js`), so each is mapped back to the
   * source beside it. Both `.ts` and `.tsx` are offered because the map cannot say which the author
   * wrote. `index.ts`/`index.tsx` are always included too — the directory-level barrel every package
   * tree already relies on, whether or not it is named in `exports`.
   */
  static of(packageDir: string): Set<string> {
    const entries = new Set<string>();
    entries.add(path.join(packageDir, 'src', 'index.ts'));
    entries.add(path.join(packageDir, 'src', 'index.tsx'));

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
  static packages(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    if (entries.includes('package.json')) out.push(dir);
    for (const entry of entries) {
      if (PublishedEntries.SKIP_DIR.has(entry)) continue;
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) PublishedEntries.packages(full, out);
    }
    return out;
  }
}

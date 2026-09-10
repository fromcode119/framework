import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * `*.enum.ts` belongs in an `enums/` folder and `*.interface.ts` in an `interfaces/` folder.
 *
 * The convention is already overwhelmingly followed — the strays are the residue of files created in
 * place and never relocated. They are invisible to every other check: a misplaced file compiles, passes
 * every type gate, and is only ever noticed by a person reading the tree, which is exactly how these
 * accumulated.
 *
 * Ratcheted per area: the count may fall, never rise.
 */
export class DeclarationPlacementGuard {
  /** Suffix -> the folder that must contain it. */
  private static readonly RULES: ReadonlyArray<{ suffix: string; folder: string }> = [
    { suffix: '.enum.ts', folder: 'enums' },
    { suffix: '.interface.ts', folder: 'interfaces' },
  ];

  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'ui-ssr',
  ]);

  static readonly BASELINE: Readonly<Record<string, number>> = {
    plugins: 0, themes: 0, framework: 0, appearance: 0,
  };

  /**
   * `appearance/` packs are FLAT — the workspace typecheck includes only `index.ts`, `*.ts`, `*.tsx` at
   * the pack root, so a declaration moved into a subfolder leaves the program entirely and every import
   * of it fails. Their declarations correctly sit beside the component.
   */
  private static isFlatArea(area: string): boolean {
    return area === 'appearance';
  }

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
        if (DeclarationPlacementGuard.SKIP_DIR.has(entry) || DeclarationPlacementGuard.isBuildOutput(full)) continue;
        DeclarationPlacementGuard.files(full, out);
      } else {
        out.push(full);
      }
    }
    return out;
  }

  /** `[]` unless the file carries a governed suffix and sits outside its folder. */
  static violationsIn(file: string): string[] {
    const normalized = file.replace(/\\/g, '/');
    const parent = path.basename(path.dirname(normalized));
    for (const { suffix, folder } of DeclarationPlacementGuard.RULES) {
      if (!normalized.endsWith(suffix)) continue;
      if (parent === folder) return [];
      return [`${path.basename(normalized)} -> belongs in ${folder}/`];
    }
    return [];
  }

  static scan(roots: readonly { area: string; dir: string }[]): {
    counts: Record<string, number>;
    detail: { area: string; file: string; hits: string[] }[];
  } {
    const counts: Record<string, number> = {};
    const detail: { area: string; file: string; hits: string[] }[] = [];
    for (const { area, dir } of roots) {
      counts[area] = counts[area] ?? 0;
      if (DeclarationPlacementGuard.isFlatArea(area)) continue;
      for (const file of DeclarationPlacementGuard.files(dir)) {
        const hits = DeclarationPlacementGuard.violationsIn(file);
        if (!hits.length) continue;
        counts[area] += hits.length;
        detail.push({ area, file, hits });
      }
    }
    return { counts, detail };
  }
}

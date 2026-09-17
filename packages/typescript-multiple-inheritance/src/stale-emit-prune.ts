import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Deletes build output whose source no longer exists.
 *
 * `tsc` only ever writes. Delete or rename a module and its old `.js`, `.d.ts` and maps stay in
 * `dist` for the life of the checkout — so the module is still importable, still resolvable by a
 * consumer, and still openable at a path the repository does not contain. A file deleted in a commit
 * carries on shipping, which is the opposite of what deleting it meant.
 *
 * Measured when it was noticed: 13 orphaned modules across four packages, one of them an interface
 * deleted minutes earlier that could still be opened at its old path.
 *
 * WHAT IS SAFE TO REMOVE, and why the rule is narrow: only `.js` / `.d.ts` / `.js.map` / `.d.ts.map`
 * under `outDir` whose matching `.ts` or `.tsx` is gone from `rootDir`. Everything else in `dist` is
 * left alone — esbuild bundles (`.cjs`), copied templates, assets — because those have no source
 * file to check against and are put there by a different step.
 *
 * A directory left empty by the prune is removed too; an empty directory in `dist` is the ghost of
 * the same deletion.
 */
export class StaleEmitPrune {
  /** The emitted extensions this owns. Ordered longest-first so `.d.ts` wins over `.ts`. */
  private static readonly EMITTED = ['.d.ts.map', '.d.ts', '.js.map', '.js'];

  /**
   * Prune one package, given its tsconfig. Returns the files removed.
   *
   * A project without both `outDir` and `rootDir` is left untouched: without them there is no way to
   * map an output back to a source, and guessing is how a prune deletes something it should not.
   */
  static apply(projectPath: string): string[] {
    const parsed = ts.getParsedCommandLineOfConfigFile(projectPath, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined,
    } as ts.ParseConfigFileHost);
    const outDir = parsed?.options?.outDir;
    const rootDir = parsed?.options?.rootDir;
    if (!outDir || !rootDir) return [];

    const removed: string[] = [];
    for (const file of StaleEmitPrune.walk(outDir)) {
      const suffix = StaleEmitPrune.EMITTED.find((extension) => file.endsWith(extension));
      if (!suffix) continue;
      const stem = path.join(rootDir, path.relative(outDir, file).slice(0, -suffix.length));
      if (ts.sys.fileExists(`${stem}.ts`) || ts.sys.fileExists(`${stem}.tsx`)) continue;
      rmSync(file, { force: true });
      removed.push(file);
    }
    StaleEmitPrune.dropEmptyDirectories(outDir);
    return removed;
  }

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) StaleEmitPrune.walk(full, out);
      else out.push(full);
    }
    return out;
  }

  /** Depth-first, so a directory emptied by its children's removal is itself removed. */
  private static dropEmptyDirectories(dir: string): boolean {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return false; }
    let empty = true;
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        if (!StaleEmitPrune.dropEmptyDirectories(full)) empty = false;
      } else {
        empty = false;
      }
    }
    if (empty) rmSync(dir, { recursive: true, force: true });
    return empty;
  }
}

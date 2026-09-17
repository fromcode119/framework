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
 * A barrel is a module whose whole job is re-export: `index.ts`, `client.ts`, `server.ts`. Everywhere
 * else, import the declaration and let the barrel publish it.
 */
export class ReExportGuard {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /** Modules whose job IS to re-publish what other modules declare. */
  private static readonly BARRELS = new Set(['index.ts', 'client.ts', 'server.ts']);

  /**
   * `export { X } from '…'` / `export type { X } from '…'` / `export * from '…'`.
   *
   * `export { X }` with no `from` is NOT this: it publishes something the file itself declared, which
   * is the file owning its own surface.
   */
  private static readonly RE_EXPORT = /^export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"][^'"]+['"]/gm;

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        if (!ReExportGuard.SKIP_DIR.has(entry)) ReExportGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !ReExportGuard.BARRELS.has(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  /** Every non-barrel module that re-exports another module's declarations. */
  static scan(roots: readonly { area: string; dir: string }[]): Array<{ file: string; lines: string[] }> {
    const offenders: Array<{ file: string; lines: string[] }> = [];
    for (const { dir } of roots) {
      for (const file of ReExportGuard.files(dir)) {
        let source: string;
        try { source = readFileSync(file, 'utf8'); } catch { continue; }
        ReExportGuard.RE_EXPORT.lastIndex = 0;
        const lines = (source.match(ReExportGuard.RE_EXPORT) ?? []).map((line) => line.trim());
        if (lines.length) offenders.push({ file, lines });
      }
    }
    return offenders;
  }
}

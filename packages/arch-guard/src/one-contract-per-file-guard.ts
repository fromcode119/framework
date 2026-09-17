import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * An `*.interface.ts` file declares ONE contract.
 *
 * Measured across the tree: 746 of 748 such files already hold exactly one `export interface` / `type`
 * / `class`. It is the convention by an overwhelming margin — and nothing enforced it, so the two that
 * do not were invisible. One of them was created while this very sweep was running, and a three-
 * interface file was moved into `interfaces/` without anything objecting, because the only thing
 * reading these files was a human.
 *
 * WHY IT MATTERS beyond tidiness: `interfaces/<name>.interface.ts` is a addressable name. A file
 * holding three contracts cannot be imported by the one you want, cannot be moved without moving all
 * three, and quietly becomes the `*.types.ts` bag this codebase has already banned once. It also
 * defeats file-level exemptions — `LOAD_BEARING_TYPES` names a FILE, so a second declaration added
 * beside an exempt one inherits the exemption it was never granted.
 *
 * A re-export (`export type { X } from './x'`) is not a declaration and is not counted: a barrel line
 * declares nothing.
 */
export class OneContractPerFileGuard {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

  /** `export interface X`, `export type X =`, `export class X` — but never `export type { … } from`. */
  private static readonly DECLARATION = /^export\s+(?:interface|class)\s+\w|^export\s+type\s+\w+\s*(?:<[^=]*>)?\s*=/gm;

  static declarationsIn(file: string): string[] {
    let source: string;
    try { source = readFileSync(file, 'utf8'); } catch { return []; }
    OneContractPerFileGuard.DECLARATION.lastIndex = 0;
    return (source.match(OneContractPerFileGuard.DECLARATION) ?? []).map((line) => line.trim());
  }

  private static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (statSync(full, { throwIfNoEntry: false })?.isDirectory()) {
        if (!OneContractPerFileGuard.SKIP_DIR.has(entry)) OneContractPerFileGuard.files(full, out);
      } else if (entry.endsWith('.interface.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  /** Every `*.interface.ts` under these roots that declares more than one contract. */
  static scan(roots: readonly { area: string; dir: string }[]): Array<{ file: string; declarations: string[] }> {
    const offenders: Array<{ file: string; declarations: string[] }> = [];
    for (const { dir } of roots) {
      for (const file of OneContractPerFileGuard.files(dir)) {
        const declarations = OneContractPerFileGuard.declarationsIn(file);
        if (declarations.length > 1) offenders.push({ file, declarations });
      }
    }
    return offenders;
  }
}

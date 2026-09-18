import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { IModuleExport } from './interfaces/module-export.interface';
import type { ISingleExportOffender } from './interfaces/single-export-offender.interface';
import { ModuleExportReader } from './module-export-reader';
import { PublishedEntries } from './published-entries';

/**
 * "class should have only 1 export and it's class nothing else — same for interface, only 1 export
 * interface, and same for enums." (Kristian, verbatim.) A class/interface/enum MODULE exports exactly
 * one thing, and that one thing matches what the file is.
 *
 * `plugin-sandbox-host-reload-service.ts` (PR #117) declared both `PluginSandboxHostReloadService`
 * and `IPluginSandboxHostAccess` in one file, while the SAME PR correctly split its other interface,
 * `ISandboxHostReloadResult`, into `interfaces/sandbox-host-reload-result.interface.ts`. One contract
 * went to the right place and the other did not, in the same commit — the convention exists, but
 * nothing checked it against file CONTENTS.
 *
 * A REGEX rule already existed for the class+interface pair, in `OopGuardFileScanner`'s `ifaceDebt`
 * bucket (`INTERFACE_DECL` needs `export`, `CLASS_DECL` is `/^export\s+(?:abstract\s+)?class/m`,
 * both applied to comment-stripped source). It is NOT fooled by the `export class Composer extends
 * Reactor {` example inside `ref.decorator.ts`'s own docblock — `OopGuard.stripComments` removes
 * block comments before either pattern runs, so that specific false-positive risk does not reproduce
 * today. The real gap is narrower and worse in a different way: `ifaceDebt` fires only when a file has
 * at least one interface, so it never sees a CLASS-only file with more than one class (`manifest.ts`'s
 * four schema classes are invisible to it); it has no notion of a `*.interface.ts` file exporting the
 * wrong KIND of single thing (a class, in `marketplace-plugin.interface.ts`'s case); and — the part
 * that actually let PR #117 ship — `ifaceDebt` is accumulated as DEBT, never added to `OopGuard`'s
 * `ZERO_BUCKETS` or its ratchet list, so it has never once failed a build. A rule that cannot fail CI
 * did not fail CI.
 *
 * WHAT COUNTS AS GOVERNED IS CONTENT, NOT ONLY A FILENAME SUFFIX. A `*.interface.ts` or `*.enum.ts`
 * file is always governed — its name is a promise about what the single export must BE. Any other
 * file is governed only once it exports at least one class or at least one interface; a file with
 * neither (a decorator, a pure function/type utility) is simply not a module this rule is about. This
 * is why `ref.decorator.ts` (no `.interface.ts` suffix) is still a real hit: it exports both an
 * interface AND a function, and exporting an interface at all puts a file in scope for "the interface
 * is the only thing this file exports" — while `bound.decorator.ts` beside it, which exports only a
 * function, is untouched.
 *
 * BARRELS ARE EXCLUDED STRUCTURALLY, not by filename. {@link PublishedEntries} (shared with
 * {@link ReExportGuard}) reads what a package's own `package.json` actually publishes; the first
 * version of that sibling guard hardcoded `index.ts|client.ts|server.ts` and reported real published
 * entry points as offenders, which is the mistake this guard does not repeat.
 *
 * SCOPE: this guard runs across every area `arch-guard` is pointed at (`GuardScope.areas`), same as
 * every other guard here — `ARCH_GUARD_SCOPE=framework` is what CI actually uses (`framework/Source`
 * CI only owns the framework tree; plugins/themes/appearance are separate repositories with their own
 * CI). At `ARCH_GUARD_SCOPE=framework` this guard is 0 once the mechanical violations below are fixed.
 * Running unscoped (the local default, every area at once) additionally reports whatever debt exists
 * in plugins/themes/appearance — a real, non-zero number that belongs to those repositories' own CI,
 * not to this one; do not read a local unscoped run as this guard's baseline.
 */
export class SingleExportModuleGuard {
  private static readonly SKIP_DIR = new Set([
    'node_modules', 'dist', '.next', 'build', 'coverage', '.git', 'tests', '__tests__',
  ]);

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
        if (SingleExportModuleGuard.SKIP_DIR.has(entry) || SingleExportModuleGuard.isBuildOutput(full)) continue;
        SingleExportModuleGuard.files(full, out);
      } else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  private static declaredKindOf(file: string): ISingleExportOffender['declaredKind'] {
    if (/\.interface\.tsx?$/.test(file)) return 'interface';
    if (/\.enum\.tsx?$/.test(file)) return 'enum';
    return 'undeclared';
  }

  /** Is this file even a class/interface/enum module? Content decides for an undeclared filename. */
  private static isGoverned(declaredKind: ISingleExportOffender['declaredKind'], exports: IModuleExport[]): boolean {
    if (declaredKind !== 'undeclared') return true;
    return exports.some((e) => e.kind === 'class' || e.kind === 'interface');
  }

  private static verdict(declaredKind: ISingleExportOffender['declaredKind'], exports: IModuleExport[]): string | null {
    if (declaredKind === 'interface') {
      if (exports.length !== 1) return `a *.interface.ts file must export exactly one interface, found ${exports.length}`;
      if (exports[0].kind !== 'interface') return `a *.interface.ts file must export an interface, found a ${exports[0].kind} ('${exports[0].name}')`;
      return null;
    }
    if (declaredKind === 'enum') {
      if (exports.length !== 1) return `a *.enum.ts file must export exactly one class, found ${exports.length}`;
      if (exports[0].kind !== 'class') return `a *.enum.ts file must export a class, found a ${exports[0].kind} ('${exports[0].name}')`;
      return null;
    }
    // Undeclared filename, governed because it exports a class or an interface: exactly one export,
    // full stop — a second export of ANY kind (another class, a helper function, a type alias) breaks
    // "nothing else exported" just as much as a second class would.
    if (exports.length !== 1) return `a class/interface module must export exactly one thing, found ${exports.length} (${exports.map((e) => `${e.kind} '${e.name}'`).join(', ')})`;
    return null;
  }

  /**
   * Every file that fails its own kind's "exactly one export" rule, plus every file the reader could
   * not parse cleanly — a file that fails to parse must be SURFACED, never silently read as "clean"
   * just because it produced no offender.
   */
  static scan(roots: readonly { area: string; dir: string }[]): { offenders: ISingleExportOffender[]; unparseable: string[] } {
    const offenders: ISingleExportOffender[] = [];
    const unparseable: string[] = [];
    for (const { dir } of roots) {
      for (const packageDir of PublishedEntries.packages(dir)) {
        const published = PublishedEntries.of(packageDir);
        for (const file of SingleExportModuleGuard.files(packageDir)) {
          if (published.has(file)) continue;
          const sourceFile = ModuleExportReader.parse(file);
          if (!sourceFile) { unparseable.push(file); continue; }
          const exports = ModuleExportReader.exportsOf(sourceFile);
          const declaredKind = SingleExportModuleGuard.declaredKindOf(file);
          if (!SingleExportModuleGuard.isGoverned(declaredKind, exports)) continue;
          const reason = SingleExportModuleGuard.verdict(declaredKind, exports);
          if (reason) offenders.push({ file, declaredKind, exports, reason });
        }
      }
    }
    return { offenders, unparseable };
  }
}

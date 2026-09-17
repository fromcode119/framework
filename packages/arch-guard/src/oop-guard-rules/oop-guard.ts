/* eslint-disable */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { GuardScope } from '../cli/guard-scope';
import { OopGuardBaselines } from './oop-guard-baselines';
import { OopGuardPatterns } from './oop-guard-patterns';
import { OopGuardFileScanner } from './oop-guard-file-scanner';

/**
 * The OOP convention guard — every rule the codebase is held to, in one class.
 *
 * Lives in typescript-multiple-inheritance because every rule here is a TypeScript-shape rule: data shapes must be interfaces,
 * classes must carry behaviour, `<Props, State>` generics belong to `@prop`/`@state`, required build-tool
 * exports are generated rather than authored, and module-level bindings belong to a class.
 *
 * Ported verbatim from the previous script — the patterns are unchanged, so the counts are comparable.
 */
export class OopGuard {
  static readonly PACKAGES_DIR = path.resolve(process.cwd(), 'packages');
  // The rule is tree-wide: plugins, themes and appearances are held to the SAME OOP standard as the
  // framework. Scanning only `packages/` is why 86 bare exports and every `'use client'` literal outside
  // the framework went unreported. Each area is scanned as a set of "packages" (its direct subdirectories).
  static readonly REPO_ROOT = path.resolve(process.cwd(), '..', '..');
  /**
   * The non-framework trees this run covers, and whether the framework's own packages are in it.
   *
   * A method rather than a constant because the answer depends on {@link GuardScope}: the framework's
   * CI guards the framework, and an extension guards itself from its own repository. Unscoped, this is
   * all three areas exactly as before.
   */
  static extraAreas(): { area: string; dir: string }[] {
    return GuardScope.areas(OopGuard.REPO_ROOT).filter((entry) => entry.area !== 'framework');
  }

  /** Is the framework's own `packages/` part of this run? */
  static includesFramework(): boolean {
    return GuardScope.areas(OopGuard.REPO_ROOT).some((entry) => entry.area === 'framework');
  }
  static readonly MODE = process.env.FRAMEWORK_OOP_MODE === 'error' ? 'error' : 'warn';

  static isGlueOrEntry(rel: string): boolean {
    const p = rel.replace(/\\/g, '/');
    if (/^(reactor|next-build-codegen|typescript-multiple-inheritance|arch-guard)\//.test(p)) return true;
    if (/(^|\/)(bin|server)\.ts$/.test(p)) return true;
    if (/(^|\/)[a-z0-9-]*-?entry(\.[a-z]+)?\.tsx?$/.test(p)) return true;
    if (/\.config\.(ts|mjs|js)$/.test(p)) return true;
    // A BUNDLE entry: an appearance root, a plugin's `src/ui`, or a theme's `ui`. Importing one of these
    // bundles must self-register it with the host (`ContextBridge.registerTheme(…)`,
    // `registerSlotComponent(…)`, `<X>AppearanceBootstrap.register(…)`), so the top-level call IS the
    // module's purpose — the same reason `bin.ts` is exempt. There is no class form for "this bundle
    // registers itself on load".
    if (/(^|\/)(appearance\/[^/]+|src\/ui|ui)\/index\.tsx?$/.test(p)) return true;
    // one-off scripts kept beside the source they exercise
    if (/(^|\/)scratch\//.test(p)) return true;
    return false;
  }

  /**
   * RETIRED as an exemption — kept only because the reasoning is worth not re-deriving.
   *
   * It used to skip `type` aliases with no declaration form (`z.infer`, `Omit<…>`, `keyof`, mapped and
   * conditional types, template-literal and primitive unions, generic aliases). The instruction is
   * "class, enum, interface — no `type`", so they are all reported now and get removed by INLINING them
   * at the use site instead of naming them. Every one attempted so far inlined cleanly.
   *
   * The original reasoning, for reference: these express something that has NO class or interface form.
   *
   * The convention is "a data record is a class, a behavioural contract is an interface" — it is not "the
   * `type` keyword is banned". These forms exist only in the type system and cannot be a declaration:
   *
   *  - `z.infer<typeof X>`            — derived FROM a runtime schema; the schema is the source of truth
   *  - `Omit`/`Pick`/`Partial`/`Required`/`Record`/`Readonly`/`Exclude`/`Extract`/`ReturnType`/`Parameters`
   *  - `keyof` / `typeof` lookups, indexed access, conditional (`extends ? :`) and mapped (`in`) types
   *  - a template-literal union (`` `plugin:${string}` ``) — no enum can enumerate it
   *  - a union of PRIMITIVES (`string | number | null`) — nothing to model
   *  - a generic alias (`Foo<T> = …`), which a class cannot stand in for at the type level
   *
   * What stays FLAGGED is exactly what the rule is about: an object-literal shape (`= { a: string }`) and
   * a plain quoted-string union (`= 'a' | 'b'`), which must be an interface and a reactor `Enum`.
   */
  static isTypeLevelOnly(source: string, at: number): boolean {
    const eq = source.indexOf('=', at);
    if (eq === -1) return false;
    // the alias is generic -> parameterised, so no declaration can replace it
    if (/<[^=]*>\s*$/.test(source.slice(at, eq))) return true;
    const semi = source.indexOf(';', eq);
    const rhs = source.slice(eq + 1, semi === -1 ? source.length : semi).trim();
    if (!rhs) return false;
    if (/^\{/.test(rhs)) return false;                       // object shape -> interface
    if (/^'[^']*'(\s*\|\s*'[^']*')*$/.test(rhs)) return false; // plain string union -> Enum
    if (/`/.test(rhs)) return true;                           // template-literal union
    if (/\b(?:z\.infer|Omit|Pick|Partial|Required|Readonly|Record|Exclude|Extract|ReturnType|Parameters|InstanceType|Awaited|NonNullable)\s*</.test(rhs)) return true;
    if (/\bkeyof\b|\btypeof\b|\bextends\b|\bin\b/.test(rhs)) return true;
    // applies a generic (`DeepReadonly<ICollection>`, `Foo<Bar>`) — a type-level expression, not a shape
    if (/[A-Za-z_$][\w$]*\s*<[^<>]*>/.test(rhs)) return true;
    if (/^[A-Za-z_$][\w$]*\s*\[[^\]]*\]/.test(rhs)) return true; // indexed access
    // a union of primitives only
    const PRIMITIVE = /^(string|number|boolean|null|undefined|symbol|bigint|unknown|any|never|void)$/;
    if (rhs.split('|').every((part) => PRIMITIVE.test(part.trim()))) return true;
    return false;
  }

  /**
   * The area a scanned package key belongs to.
   *
   * Keys arrive as `plugins/<slug>`, `themes/<slug>`, `appearance/<slug>` or a bare framework package
   * name, so the head segment names the extension tree when there is one and the framework otherwise.
   * This used to read the keys of a baseline map, which made the list of areas a side effect of a
   * debt table — delete the table and the areas went with it.
   */
  private static readonly EXTENSION_AREAS: ReadonlySet<string> = new Set(['plugins', 'themes', 'appearance']);

  static areaOf(packageKey: string): string {
    const head = packageKey.split('/')[0];
    return OopGuard.EXTENSION_AREAS.has(head) ? head : 'framework';
  }

  /**
   * Files whose default export is a CONTRACT someone else reads, not debt.
   *
   *  - `*.config.ts` / `*.config.mjs` — vitest/vite/next read the module's default export. No build
   *    step of ours runs over a tool config, so nothing could generate it.
   *  - `seed.ts` — the seed runner loads the default export the same way.
   *
   * `plugins/<slug>/index.ts` USED to be excused here, for the retired
   * `export default PluginDefinitionUtils.define({...})` entry shape. That shape is gone: a plugin entry
   * is now a plain `export class <Name>Plugin` whose statics carry the contract, and core's
   * `PluginModuleResolverService` lifts them. A default export in a plugin entry is debt again.
   */
  static ownsItsDefaultExport(rel: string): boolean {
    const path = rel.replace(/\\/g, '/');
    return /\.config\.(ts|mjs|js)$/.test(path)
      || /(^|\/)seed\.ts$/.test(path);
  }
  // A class whose body declares only fields is a DATA RECORD — it must be an interface.
  /**
   * `<Props, State>` on a component base: `@prop`/`@state` carry those, so the generics must not exist.
   *
   * `Bridge` is deliberately ABSENT. `Bridge<TValues>` is the sanctioned API — the generic names what
   * `read()` returns and `present()` receives, so it is required, not debt. Flagging it pushed a reader
   * toward "fixing" the one hook-bridge pattern the conventions prescribe, the same way the retired
   * `recordClass` bucket flagged every correct record class.
   */
  /**
   * `extends <Base><…>` — a component still carrying `<Props, State>` generics.
   *
   * Built from REACTOR's own bases plus React's, and extended by the consuming project through
   * `TSMI_COMPONENT_BASES`. The framework's `AdminComponent`/`PluginComponent`/`ThemeComponent` used to
   * be spelled out in this pattern, which welded a standalone package to one project's class names.
   */
  static componentGenerics(): RegExp {
    const extra = String(process.env.TSMI_COMPONENT_BASES ?? '')
      .split(',').map((name) => name.trim()).filter(Boolean);
    const bases = [...extra, 'PureReactor', 'Reactor', 'Provider', 'Component', 'PureComponent'];
    return new RegExp(`extends\\s+(?:React\\.)?(?:${bases.join('|')})\\s*<`, 'g');
  }


  static walk(dir: string, out: string[]): void {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === 'node_modules' || name === 'dist' || name === '.next' || name === 'build' || name === 'verify' || name === '.git' || name === 'tests') continue;
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) OopGuard.walk(full, out);
      // Skip declaration files AND test files — tests legitimately use hooks/RTL render helpers and are not
      // production component code (the `tests` dir is already skipped above; this covers *.test.ts[x]).
      else if (/\.test\.tsx?$/.test(full)) continue;
      else if (full.endsWith('.tsx') || (full.endsWith('.ts') && !full.endsWith('.d.ts'))) out.push(full);
    }
  }

  // Strip line/block comments so `// use a hook` prose and doc blocks never trip the detectors.
  static stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }


  /** Scan every target and return the per-package buckets. */
  static scan(): Map<string, Record<string, any>> {
  const perPackage = new Map<string, Record<string, any>>(); // pkg -> { violations: [], warnings: [], files: n }
  // Names that appear in ANY `implements` clause anywhere in the tree. Collected in a first pass so an
  // interface declared in one package and implemented in another is still counted as a real contract.
  const implementedNames = new Set<string>();
  const usageCount = new Map<string, number>();
  const allScanFiles: Array<{ label: string; file: string }> = [];
  
  let pkgs: string[] = [];
  try {
    pkgs = readdirSync(OopGuard.PACKAGES_DIR);
  } catch {
    // THROW, never `process.exit` — see the note in `plugin-ui-hook-guard`. Exiting from inside a
    // guard ends the whole `arch-guard ci` pass; an unreadable target is a failure, not a clean scan.
    throw new Error(`Cannot read packages dir: ${OopGuard.PACKAGES_DIR}`);
  }
  
  // Build the full scan list FIRST: (area, package, files). Scanning whole package dirs — not four
  // hardcoded roots — so nothing outside src/app/components/lib can hide.
  const targets: Array<{ label: string; files: string[] }> = [];
  for (const pkg of OopGuard.includesFramework() ? pkgs : []) {
    if (OopGuardBaselines.EXEMPT_PACKAGES.has(pkg)) continue;
    const files: string[] = [];
    OopGuard.walk(path.join(OopGuard.PACKAGES_DIR, pkg), files);
    if (files.length) targets.push({ label: pkg, files });
  }
  for (const { area, dir } of OopGuard.extraAreas()) {
    // A TREE's direct subdirectories are its extensions (`plugins/<slug>`); a single extension IS the
    // package. Walking a scoped extension's subdirectories instead would relabel `src` and `tests` as
    // packages, which is not cosmetic: the allowlists and exemptions are keyed on the extension, so
    // none of them would match and the count explodes — 530 reported for one plugin that has 15.
    if (GuardScope.isExtension(OopGuard.REPO_ROOT)) {
      const files: string[] = [];
      OopGuard.walk(dir, files);
      if (files.length) targets.push({ label: `${area}/${path.basename(dir)}`, files });
      continue;
    }
    let subdirs: string[] = [];
    try { subdirs = readdirSync(dir); } catch { continue; }
    for (const name of subdirs) {
      const files: string[] = [];
      OopGuard.walk(path.join(dir, name), files);
      if (files.length) targets.push({ label: `${area}/${name}`, files });
    }
  }
  
  // First pass: every name any class declares it `implements`, plus where every identifier is USED —
  // both tree-wide.
  //
  // Usage matters because "no class implements it" is NOT the same as "nothing satisfies it". A contract
  // can be satisfied STRUCTURALLY: `IRestController` is satisfied by the api package's controller, which
  // `ai` must not import (that would invert the dependency), so no `implements` clause can ever name it.
  // Reporting those made the bucket noise. What is genuinely worth reporting is an interface nothing
  // references at all — a dead contract.
  for (const { files } of targets) {
    for (const file of files) {
      let raw = '';
      try { raw = readFileSync(file, 'utf8'); } catch { continue; }
      const code = OopGuard.stripComments(raw);
      for (const m of code.matchAll(OopGuardPatterns.IMPLEMENTS_CLAUSE)) {
        for (const name of m[1].split(',')) {
          const clean = name.trim().replace(/<.*$/, '').split('.').pop();
          if (clean) implementedNames.add(clean);
        }
      }
      // ANY capitalised identifier — an interface without the `I` prefix would otherwise never be
      // counted and would always read as dead.
      for (const m of code.matchAll(/\b([A-Z]\w+)\b/g)) {
        usageCount.set(m[1], (usageCount.get(m[1]) ?? 0) + 1);
      }
    }
  }
  
    OopGuardFileScanner.collect(targets, perPackage, implementedNames, usageCount);
  
  
    return perPackage;
  }
}

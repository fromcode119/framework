/* eslint-disable */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { OopGuardBaselines } from './oop-guard-baselines';
import { OopGuardPatterns } from './oop-guard-patterns';

/**
 * The OOP convention guard — every rule the codebase is held to, in one class.
 *
 * Lives in typor because every rule here is a TypeScript-shape rule: data shapes must be interfaces,
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
  static readonly EXTRA_AREAS = [
    { area: 'plugins', dir: path.join(OopGuard.REPO_ROOT, 'plugins') },
    { area: 'themes', dir: path.join(OopGuard.REPO_ROOT, 'themes') },
    { area: 'appearance', dir: path.join(OopGuard.REPO_ROOT, 'appearance') },
  ];
  static readonly MODE = process.env.FRAMEWORK_OOP_MODE === 'error' ? 'error' : 'warn';

  static isGlueOrEntry(rel: string): boolean {
    const p = rel.replace(/\\/g, '/');
    if (/^(reactor|nextor|typor|arch-guard)\//.test(p)) return true;
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

  /** The baseline area a scanned package key belongs to. */
  static areaOf(packageKey: string): string {
    const head = packageKey.split('/')[0];
    return head in OopGuardBaselines.VIOLATION_BASELINE && head !== 'framework' ? head : 'framework';
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
  private static ownsItsDefaultExport(rel: string): boolean {
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
   * `TYPOR_COMPONENT_BASES`. The framework's `AdminComponent`/`PluginComponent`/`ThemeComponent` used to
   * be spelled out in this pattern, which welded a standalone package to one project's class names.
   */
  static componentGenerics(): RegExp {
    const extra = String(process.env.TYPOR_COMPONENT_BASES ?? '')
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
    console.error(`Cannot read packages dir: ${OopGuard.PACKAGES_DIR}`);
    process.exit(2);
  }
  
  // Build the full scan list FIRST: (area, package, files). Scanning whole package dirs — not four
  // hardcoded roots — so nothing outside src/app/components/lib can hide.
  const targets: Array<{ label: string; files: string[] }> = [];
  for (const pkg of pkgs) {
    if (OopGuardBaselines.EXEMPT_PACKAGES.has(pkg)) continue;
    const files: string[] = [];
    OopGuard.walk(path.join(OopGuard.PACKAGES_DIR, pkg), files);
    if (files.length) targets.push({ label: pkg, files });
  }
  for (const { area, dir } of OopGuard.EXTRA_AREAS) {
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
  
  for (const { label: pkg, files } of targets) {
    const bucket: Record<string, any> = {
      violations: [] as string[], warnings: [] as string[], enumDebt: [] as string[], ifaceDebt: [] as string[],
      exportDebt: [] as string[], clientDebt: [] as string[], orphanIface: [] as string[],
      defaultExport: [] as string[], topLevel: [] as string[], typeAlias: [] as string[], propsGeneric: [] as string[],
      defaultClass: [] as string[], moduleDecl: [] as string[], enumPlacement: [] as string[],
      typesFile: [] as string[], files: 0,
    };
    perPackage.set(pkg, bucket);
    const allow = OopGuardBaselines.ALLOW_PACKAGES.has(pkg);
    for (const file of files) {
      const rel = path.relative(OopGuard.PACKAGES_DIR, file);
      const raw = readFileSync(file, 'utf8');
      // Build OUTPUT that happens to sit beside source, because the tool demands that exact path
      // (nextor writes `proxy.ts` for Next's middleware). Its `export const` bindings are generated on
      // purpose — holding them to the source rules would report the very thing the generator exists to
      // keep out of source.
      if (raw.startsWith('// GENERATED by @fromcode119/')) continue;
      bucket.files += 1;
      const src = OopGuard.stripComments(raw);
      const found: string[] = [];
      // `Bridge` (reactor) IS the sanctioned hook boundary: its `read()` is the one place a hook may be
      // called so everything above it stays a class. A file whose component extends Bridge is therefore
      // reported as a warning, not a violation — the same standing the old hand-written shims had, but
      // structural (grep-able, self-maintaining) instead of a hand-kept path allowlist.
      const isReactorBridge = /class\s+\w+\s+extends\s+Bridge\b/.test(src);
      if (OopGuardPatterns.REACT_IMPORT.test(src)) found.push(`${rel}: non-type import from 'react'`);
      if (OopGuardPatterns.BUILTIN_HOOK.test(src)) found.push(`${rel}: React hook call`);
      else if (file.endsWith('.tsx') && OopGuardPatterns.CUSTOM_HOOK.test(src)) found.push(`${rel}: custom hook invocation (use<X>())`);
      if (OopGuardPatterns.RAW_REACT.test(src)) found.push(`${rel}: raw React escape hatch (createElement/forwardRef/createContext/memo/…)`);
      // Next route files (page/layout/route/loading/error/not-found/template/default/global-error) MUST
      // default-export a component and async server components can't be classes — the thin function shim there
      // is framework-required, so skip the OopGuardPatterns.FC check for them (hooks / raw-React are still flagged).
      const isNextRouteFile = /(^|\/)(page|layout|route|loading|error|not-found|template|default|global-error)\.(tsx|ts)$/.test(rel);
      if (file.endsWith('.tsx') && !isNextRouteFile && OopGuardPatterns.FC.test(src)) found.push(`${rel}: 'export const/function <Capitalized>' or React.FC (function component)`);
      // Soft-warn only.
      if (OopGuardPatterns.PROPS_GENERIC.test(src)) bucket.warnings.push(`${rel}: <Props, State> generic — @prop/@state should carry it [soft]`);
      // Enum-debt (non-fatal): closed-string unions that must become reactor Enums.
      for (const m of src.matchAll(OopGuardPatterns.NAMED_STRING_UNION)) bucket.enumDebt.push(`${rel}: named union '${m[1]}'`);
      for (const m of src.matchAll(OopGuardPatterns.INLINE_STRING_UNION)) bucket.enumDebt.push(`${rel}: inline union ${m[0].trim().slice(0, 48)}`);
      // Interface-debt (non-fatal): non-`I`-prefixed names + >1 interface per file.
      const ifaces = [...src.matchAll(OopGuardPatterns.INTERFACE_DECL)].map((m) => m[1]);
      for (const nm of ifaces) if (!/^I[A-Z]/.test(nm)) bucket.ifaceDebt.push(`${rel}: interface '${nm}' not I-prefixed`);
      // Generated files (nextor RoutePlugin output) are build artifacts, not authored source — their
      // `export default function` IS the Next bridge. The authored `*.class.*` sibling is what counts.
      const isGenerated = /^\/\/ GENERATED by (@fromcode119\/)?nextor/m.test(raw.slice(0, 200));
      // Strip template literals / block comments so codegen TEMPLATES aren't counted as real exports.
      const codeOnly = src.replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``').replace(/\/\*[\s\S]*?\*\//g, '');
      if (!isGenerated) for (const m of codeOnly.matchAll(OopGuardPatterns.EXPORT_FUNC)) bucket.exportDebt.push(`${rel}: export ${m[1] ? 'default ' : ''}function ${m[2] || '(anonymous)'}`);
      if (!isGenerated) for (const m of codeOnly.matchAll(OopGuardPatterns.EXPORT_CONST)) bucket.exportDebt.push(`${rel}: export const ${m[1]}`);
      // A `*.types.ts` / `*.interfaces.ts` BAG is the retired convention: a data record is a class, a
      // behavioural contract is `interfaces/<name>.interface.ts`, and a genuinely type-level construct
      // (`DeepReadonly`, a `z.infer`) gets its OWN descriptively-named file. The suffix itself is the smell.
      if (/\.(types|interfaces)(\.internal)?\.tsx?$/.test(rel)) {
        bucket.typesFile.push(`${rel}: a *.types.ts bag — split into interfaces/ or a purpose-named file`);
      }
      // An enum file belongs in an `enums/` directory — 204 of them already were, and the ten that were
      // not had to be pointed out by hand. Placement is a property of the path, so this needs no parsing.
      if (/\.enums?\.tsx?$/.test(rel) && path.basename(path.dirname(rel)) !== 'enums') {
        bucket.enumPlacement.push(`${rel}: enum file outside an enums/ directory`);
      }
      // Anything declared OUTSIDE a class. Skipped for generated output, for the packages that ARE the
      // non-OOP glue layer (reactor/nextor/typor/arch-guard), and for process ENTRY POINTS, whose whole job is
      // a top-level call — there is no class for `APIServer.bootstrap()` to live in.
      if (!isGenerated && !OopGuard.isGlueOrEntry(rel) && !OopGuardBaselines.LOAD_BEARING_TYPES.has(rel.replace(/\\/g, '/'))) {
        for (const m of codeOnly.matchAll(OopGuardPatterns.MODULE_DECL)) {
          bucket.moduleDecl.push(`${rel}: module-level ${m[2]} '${m[3]}' outside a class`);
        }
        for (const m of codeOnly.matchAll(OopGuardPatterns.MODULE_DESTRUCTURE)) {
          bucket.moduleDecl.push(`${rel}: module-level ${m[2]} ${m[3]}…${m[3] === '{' ? '}' : ']'} destructuring outside a class`);
        }
        // A module that exports NOTHING exists only for its side effects — that is structurally a
        // bundle entry (`tracker.ts` self-registers a plugin client and returns nothing), and there is
        // no class form for it. Detected from content rather than a path allowlist, so it stays
        // self-maintaining; a file that gains an export is measured again from that moment.
        if (/^export\s/m.test(codeOnly)) {
          for (const m of codeOnly.matchAll(OopGuardPatterns.MODULE_CALL)) {
            bucket.moduleDecl.push(`${rel}: module-level call '${m[1]}(…)' outside a class`);
          }
        }
      }
      // `'use client'` belongs to the `.client.` FILENAME, injected by nextor at build time — never source.
      if (OopGuardPatterns.USE_CLIENT_LITERAL.test(raw)) bucket.clientDebt.push(`${rel}: 'use client' literal in source`);
      // An interface no class implements is a data record, not a contract — model it as a class.
      for (const m of codeOnly.matchAll(OopGuardPatterns.INTERFACE_DECL)) {
        // A DATA SHAPE is an interface and needs no implementor — that is the convention, not a defect.
        // Only a BEHAVIOURAL contract (declares methods) that nothing implements is worth reporting.
        if (implementedNames.has(m[1])) continue;
        const at = codeOnly.indexOf('{', m.index);
        if (at === -1) continue;
        let depth = 0, end = -1;
        for (let k = at; k < codeOnly.length; k++) {
          if (codeOnly[k] === '{') depth++;
          else if (codeOnly[k] === '}') { depth--; if (depth === 0) { end = k; break; } }
        }
        if (end === -1) continue;
        const ibody = codeOnly.slice(at + 1, end);
        // A METHOD is `foo(): T` — a callback FIELD (`onClick: () => void`) is data, not a contract.
        // Counting the latter flagged every props interface in the tree as an unimplemented contract.
        const hasMethods = /^\s*\w+\??\s*\([^)]*\)\s*:/m.test(ibody);
        // 1 occurrence == only its own declaration, so nothing anywhere uses it.
        const dead = (usageCount.get(m[1]) ?? 0) <= 1;
        if (hasMethods && dead) bucket.orphanIface.push(`${rel}: interface ${m[1]} is declared and never used`);
      }
      // A build-tool entry generated by nextor is glue, not authored source — skip every authored-code rule.
      const isNextorGenerated = /^\/\/ GENERATED by @fromcode119\/nextor/m.test(raw.slice(0, 200));
      if (!isGenerated && !isNextorGenerated) {
        for (const m of codeOnly.matchAll(OopGuard.componentGenerics())) {
          // An abstract base that FORWARDS its own type parameters (`class X<P, S> extends Reactor<P, S>`)
          // is the mechanism by which subclasses get typed props — not debt. Only a CONCRETE component
          // naming concrete <Props, State> is.
          // Match on `abstract class` alone: a generic parameter list may itself contain `>`
          // (`<P = Record<string, unknown>>`), so a `<[^>]*>` lookback stops at the first inner `>`.
          const head = codeOnly.slice(Math.max(0, (m.index ?? 0) - 200), m.index ?? 0);
          if (/\babstract\s+class\s+\w+\s*<[\s\S]*$/.test(head)) continue;
          bucket.propsGeneric.push(`${rel}: '${m[0].trim()}…' generics (use @prop/@state)`);
        }
        for (const m of codeOnly.matchAll(OopGuardPatterns.EXPORT_DEFAULT_CLASS)) bucket.defaultClass.push(`${rel}: 'export default class' (generate the default via nextor)`);
        if (OopGuardPatterns.EXPORT_DEFAULT_EXPR.test(codeOnly) && !OopGuard.ownsItsDefaultExport(rel)) {
          bucket.defaultExport.push(`${rel}: 'export default <expression>' (generate it via nextor)`);
        }
        for (const m of codeOnly.matchAll(OopGuardPatterns.TOP_LEVEL_BINDING)) bucket.topLevel.push(`${rel}: module-level '${m[0].trim().slice(0, 40)}' (move into the class)`);
        for (const m of codeOnly.matchAll(OopGuardPatterns.TYPE_ALIAS)) bucket.typeAlias.push(`${rel}: type alias '${m[1]}' (interface, or reactor Enum)`);
      }
      if (ifaces.length > 1) bucket.ifaceDebt.push(`${rel}: ${ifaces.length} interfaces in one file (split one-per-file)`);
      if (!found.length) continue;
      // Normalize BOTH client-boundary conventions so allowlist entries (kept under the plain path) keep
      // matching: the `.client` filename infix (X.tsx -> X.client.tsx) and the `view/` folder that those
      // client modules now live in (a/b.client.tsx -> a/view/b.client.tsx). Without the second, moving a
      // file into `view/` silently revokes its exemption and it reappears as a "new" violation.
      const relKey = rel.replace(/\.client\.(tsx|ts)$/, '.$1').replace(/(^|\/)view\/([^/]+)$/, '$1$2');
      if (allow) bucket.warnings.push(...found.map((v) => `${v} [bridge — allowlisted]`));
      else if (isReactorBridge) bucket.warnings.push(...found.map((v) => `${v} [reactor Bridge — the sanctioned hook boundary]`));
      else if (OopGuardBaselines.ALLOW_FILES.has(rel) || OopGuardBaselines.ALLOW_FILES.has(relKey)) bucket.warnings.push(...found.map((v) => `${v} [allowlisted — hook API / false positive]`));
      else bucket.violations.push(...found);
    }
  }
  
  
    return perPackage;
  }
}

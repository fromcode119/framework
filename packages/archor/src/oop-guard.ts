/* eslint-disable */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

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

  // The reactor conventions live here; these packages ARE the exception (decorators + html + build magic).
  static readonly EXEMPT_PACKAGES = new Set(['reactor', 'nextor']);
  // The framework React bridge (@fromcode119/react) may import react for its providers UNTIL converted.
  // Its violations are always reported as warnings and never counted toward the fatal total, even in error mode.
  static readonly ALLOW_PACKAGES = new Set(['react']);

  // Files reported as warnings, never violations — either intentional framework HOOK APIs that CONSUMERS
  // (themes/plugins) call as hooks (converting them would break the public API), or genuine false positives
  // (React tokens that live inside string literals / codegen templates, not real usage).
  /**
   * Debt buckets that have been driven to ZERO and must stay there.
   *
   * A count that reached zero is a rule the codebase now satisfies, so it is enforced like a violation:
   * `FRAMEWORK_OOP_MODE=error` fails the build when any of these is non-empty again. Buckets still being
   * worked down stay advisory — add one here the moment it hits zero, never remove one to make a build pass.
   *
   *  - clientDebt   — `'use client'` literal in source (the `.client.` filename carries it)
   *  - defaultClass — `export default class` (nextor generates Next's default export at build time)
   */
  /**
   * Per-area violation ceilings. The framework itself is at ZERO and stays there; the extension areas
   * carry historical debt and are ratcheted — the count may fall, never rise.
   *
   * Areas are keyed by the first path segment of the scanned package (`plugins/…`, `themes/…`,
   * `appearance/…`); everything else is a framework package. LOWER a number when you fix violations;
   * never raise one to make a build pass.
   */
  static readonly VIOLATION_BASELINE: Record<string, number> = {
    framework: 0,
    plugins: 46,
    themes: 19,
    appearance: 1,
  };

  /**
   * Per-area ceilings for `moduleDecl` — anything declared OUTSIDE a class.
   *
   * The framework is at ZERO and enforced, which is the point: this rule had to be pointed out by hand
   * file after file because no bucket measured it (`exportDebt` only ever saw EXPORTED consts and
   * functions, so a non-exported `type Foo = {…}` or a bare `const CACHE = …` was invisible). Now the
   * build says it instead.
   *
   * Extension areas carry historical debt and are ratcheted: the count may fall, never rise.
   */
  /**
   * Per-area ceilings for `typesFile` — `*.types.ts` / `*.interfaces.ts` bags. Framework is at ZERO and
   * enforced; the extension areas are ratcheted.
   */
  static readonly TYPES_FILE_BASELINE: Record<string, number> = {
    framework: 0,
    plugins: 72,
    themes: 6,
    appearance: 0,
  };

  static readonly MODULE_DECL_BASELINE: Record<string, number> = {
    framework: 0,
    // Re-set when `isTypeLevelOnly` was retired: the bucket now counts EVERY module-level `type`, not
    // only object shapes and string unions, so these are the same debt measured more strictly.
    plugins: 191,
    themes: 37,
    appearance: 1,
  };

  /**
   * Files exempt from the `moduleDecl` bucket.
   *
   *  - `reactor` / `nextor` / `typor` / `archor` — these packages ARE the layer that confines the
   *    non-OOP parts of React and the build; decorators and tags must be functions by JS spec.
   *  - `bin.ts` / `server.ts` / `*-entry.ts(x)` / `*.entry.ts` — a process or bundle ENTRY POINT is a
   *    top-level call by definition.
   *  - `*.d.ts` shims and `vite`/`tool` config entries, which the tool loads on its own terms.
   */
  /**
   * `type` declarations the framework keeps, named individually so the count stays 0 and a NEW one still
   * fails the build.
   *
   * EMPTY, and it should stay that way. The last two entries (`DeepReadonly`, `CollectionInput`) were
   * retired once it became clear the recursive mapped type was never actually required: TypeScript
   * ignores `readonly` PROPERTY modifiers when checking assignability, so a deeply-frozen `as const`
   * literal already assigns to a mutable shape. The only thing that ever failed was `readonly T[]` → `T[]`.
   * Marking the ARRAY containers readonly is therefore sufficient, and that IS expressible as a plain
   * (recursive) interface — see `ICollectionInput` / `IFieldInput`.
   */
  static readonly LOAD_BEARING_TYPES: ReadonlySet<string> = new Set<string>([]);

  static isGlueOrEntry(rel: string): boolean {
    const p = rel.replace(/\\/g, '/');
    if (/^(reactor|nextor|typor|archor)\//.test(p)) return true;
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
    return head in OopGuard.VIOLATION_BASELINE && head !== 'framework' ? head : 'framework';
  }

  /**
   * Files whose default export is a CONTRACT someone else reads, not debt.
   *
   *  - `plugins/<slug>/index.ts` — a plugin ships exactly ONE `export default
   *    PluginDefinitionUtils.define({...})`; that single default IS the plugin manifest contract.
   *  - `*.config.ts` / `*.config.mjs` — vitest/vite/next read the module's default export. No build
   *    step of ours runs over a tool config, so nothing could generate it.
   *  - `seed.ts` — the seed runner loads the default export the same way.
   */
  private static ownsItsDefaultExport(rel: string): boolean {
    const path = rel.replace(/\\/g, '/');
    return /(^|\/)plugins\/[^/]+\/index\.ts$/.test(path)
      || /\.config\.(ts|mjs|js)$/.test(path)
      || /(^|\/)seed\.ts$/.test(path);
  }

  /**
   * RETIRED: the `recordClass` bucket ("class with no methods → make it an interface I<Name>").
   *
   * It encoded the OLD rule. The convention is the opposite — a data record IS a class; an `interface`
   * survives only for a genuine behavioural contract. The bucket therefore flagged every correct record
   * class (`Column`, `SelectOption`, `PluginRuntimeValue`) as debt.
   *
   * Its detection was broken too: the body scan began at the first `{` after the class name, which for
   * `class DataTable<T extends { id: any }>` is the brace inside the GENERIC CONSTRAINT — so it read a
   * two-token body and declared a 24-member component "has no methods". It also flagged classes that
   * inherit all their behaviour (`class AuthController extends AuthControllerSelfService {}`).
   */
  static readonly ZERO_BUCKETS = ['clientDebt', 'defaultClass', 'defaultExport', 'enumPlacement'];

  static readonly ALLOW_FILES = new Set([
    // Theme-facing hook APIs — themes call `LiveBlocks.useLiveBlocks(page)` / `PublicSettings.useSettings()`.
    'core/src/live-blocks.ts',
    'core/src/public-settings.ts',
    // Theme-facing hook API — consumers call `InteractiveCanvas.use()` inside their own function components.
    // The Provider/Wrapper in this file are ALREADY reactor classes; the sole remaining hit is the static
    // `use()` convenience hook (a public consumer API, like `LiveBlocks.useLiveBlocks`) — keep it.
    'core/src/interactive-canvas/interactive-canvas-context.tsx',
    // False positive: `useState`/`useEffect`/… are STRING LITERALS in REACT_BROWSER_RUNTIME_EXPORT_KEYS —
    // the runtime bridge's export-key manifest, not real hook calls. No React usage in this service.
    'core/src/plugin/services/runtime-service.ts',
    // False positives: `React.createElement` is an esbuild `jsxFactory` string; `import React` lives inside
    // the plugin-scaffold codegen TEMPLATE strings — neither is real React usage in this file.
    'cli/src/commands/plugin-build-command-service.ts',
    'cli/src/commands/plugin-scaffold-command-service.ts',
    // Irreducible Next-navigation-hook boundaries: these render a minimal function component that calls
    // useRouter/usePathname (next/navigation) — hooks with NO class API, so exactly one function boundary is
    // unavoidable (same principle as the react bridge's PluginRuntimeProvider).
    'frontend/app/components/root-provider.tsx',
    'frontend/app/not-found.tsx',

    // --- ADMIN HOOK-BOUNDARY LAYER (irreducible) -----------------------------------------------------------
    // React hooks have no class API, so the admin needs ONE functional boundary that reads every hook/context
    // and republishes it through AdminRuntimeContext — that is precisely what lets EVERY other admin component
    // be a hook-free `extends AdminComponent` class. Converting these would defeat the migration, not advance it.
    'admin/app/client-layout.tsx',
    'admin/app/client-layout-shell.tsx',
    'admin/app/appearance-runtime-loader.tsx',
    'admin/app/appearance-security-gate.tsx',
    'admin/app/appearance-shell-host-shim.tsx',
    'admin/app/plugin-loader.tsx',
    'admin/app/services/client-layout-auth-state-hooks.ts',
    'admin/app/services/client-layout-navigation-state-hooks.ts',
    'admin/app/services/client-layout-sidebar-state-hooks.ts',
    'admin/components/admin-runtime-context.tsx',
    'admin/components/admin-runtime-provider.tsx',
    'admin/components/admin-runtime-provider-view.tsx',
    'admin/components/auth-context.tsx',
    'admin/components/auth-provider-view.tsx',
    'admin/components/auth-store.ts',
    'admin/components/notification-context.tsx',
    'admin/components/notification-context-store.ts',
    'admin/components/theme-context.tsx',
    'admin/components/theme-context-store.ts',
    // Consumer-facing hook APIs (the admin's equivalent of ContextHooks) — callers use them inside the one
    // functional boundary above; converting them would break that contract.
    'admin/components/use-auth.ts',
    'admin/components/use-notification.ts',
    'admin/components/use-theme.ts',
    // Thin hook-boundary SHIM: reads irreducible `use(params)`/useRouter/useSearchParams once and forwards the
    // values as props to the CollectionEditPageView CLASS which owns all state/effects/handlers.
    'admin/components/collection/collection-edit-page.tsx',

    // --- FRONTEND: legitimate React RUNTIME-VALUE consumers -------------------------------------------------
    // These call React 19's `cache()` for per-request memoization. `cache` is a runtime VALUE, so it MUST stay a
    // value import — type-ifying it erased it at runtime and broke `next build`
    // ("ReferenceError: cache is not defined"). Not a migration gap.
    'frontend/lib/dynamic-page-resolver.ts',
    'frontend/lib/frontend-config-cache.ts',
    'frontend/lib/frontend-public-settings.ts',
    'frontend/lib/frontend-translations-cache.ts',
    'frontend/lib/plugin-injection-renderer.ts',
    'frontend/lib/resolved-content-metadata.ts',
    'frontend/lib/theme/page-doc-prefetch-request-cache.ts',
    'frontend/lib/theme/theme-prefetch-request-cache.ts',
    // Async SERVER component (injects theme CSS/head hints). Async server components cannot be React classes.
    'frontend/components/theme-assets.tsx',

    // --- IRREDUCIBLE React interop (verified per-file 2026-07-24) — allowlisted with reason category ------
    // (a) HOOK-BOUNDARY CONTAINERS: use next/navigation useRouter/usePathname/useSearchParams / React `use(params)` /
    //     bespoke controller hooks — none have a class API; each reads hooks once and drives a view class.
    'admin/app/plugins/[slug]/page.tsx',
    'admin/app/plugins/[slug]/plugin-detail-page-controller.ts',
    'admin/app/plugins/installed/components/page-client.tsx',
    'admin/app/sidebar-nav-item.tsx',
    'admin/components/collection/list/page-client.tsx',
    'admin/components/settings/backups/backups-page-client.tsx',
    'admin/components/settings/backups/backups-page-controller.ts',
    'admin/components/settings/backups/use-system-backups.ts',
    'admin/app/media/components/page-client.tsx',
    'admin/app/plugins/layout.tsx',
    'admin/app/themes/installed/page.tsx',
    'admin/app/themes/layout.tsx',
    'admin/components/media/media-picker.tsx',
    'frontend/app/components/global-initializer.tsx',
    'frontend/components/system-gate.tsx',
    // (b) KEYED `<Fragment key=…>`: the automatic JSX runtime supplies `<>` but NOT a keyed Fragment, so a real
    //     `import { Fragment } from 'react'` value import is required here.
    'admin/app/media/components/media-toolbar.tsx',
    'admin/app/sidebar-nav-groups.tsx',
    'admin/components/ui/admin-page-footer.tsx',
    'admin/components/ui/data-table.tsx',
    'admin/components/ui/dropdown.tsx',
    'admin/components/ui/move-dialog.tsx',
    // (c) DYNAMIC-COMPONENT RENDERERS via React.createElement of a resolved component. The `.ts` ones can't hold
    //     JSX; the renderers intentionally build elements from runtime-provided component types.
    'admin/components/collection/custom-field-error-boundary.ts',
    'admin/components/collection/field-custom-component.tsx',
    'admin/components/collection/list/page-service.ts',
    'admin/components/ui/array-field-row-renderer.tsx',
    'frontend/app/plugin-loader-mount-service.ts',
  ]);

  // --- detectors -------------------------------------------------------------
  // Non-type react import: an `import ... from 'react'|'react-dom'` statement NOT beginning with `import type`.

  static readonly REACT_IMPORT = /^\s*import\s+(?!type\b)[^;]*?\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/m;
  // Built-in hooks.
  // A hook CALL — the trailing `(` matters: `ReturnType<typeof Hooks.useState>` in a .interfaces.ts file is a
  // TYPE reference, not a call, and must not be reported as a hook.
  static readonly BUILTIN_HOOK = /\buse(State|Effect|LayoutEffect|Memo|Ref|Callback|Context|Id|Reducer|Transition|DeferredValue|SyncExternalStore|ImperativeHandle|InsertionEffect)\s*\(/;
  // Custom hook invocation: bare `useXxx(` not preceded by `.` (namespace/method calls) or a word char.
  // Applied to .tsx only — in .ts, `static useSink(` (a method DEFINITION) is a false positive; real React
  // hooks live in components (.tsx), and a .ts that touches React still trips OopGuard.REACT_IMPORT / OopGuard.BUILTIN_HOOK.
  static readonly CUSTOM_HOOK = /(?<![.\w])use[A-Z]\w*\s*\(/;
  // Raw React escape hatches that reactor replaces with class mechanics. DOTTED form only (`React.memo`) so
  // unrelated method calls like `manager.createContext(...)` are not mistaken for React usage.
  static readonly RAW_REACT = /\bReact\.(createElement|forwardRef|createContext|memo|cloneElement|PureComponent|Children|isValidElement)\b/;
  // Function component / React.FC.
  static readonly FC = /export\s+(default\s+)?(const|function)\s+[A-Z][A-Za-z0-9]*|export\s+default\s+function\s*\(|:\s*React\.FC\b/;
  // Soft-warn: <Props, State> generic on a Component base.
  static readonly PROPS_GENERIC = /extends\s+(React\.)?(Pure)?Component\s*</;
  // Closed-string-set unions → must be a reactor `Enum`, never a raw string union. Both a NAMED alias
  // (`export type X = 'a' | 'b'`) and an INLINE field (`  status: 'a' | 'b'`). Server wire/DB unions still
  // STORE a string (via `Enum.value`) but the TYPE must be an Enum. Reported as ENUM-DEBT (non-fatal) so the
  // build isn't broken before the backlog is burned down; drive it to zero, then promote to a hard violation.
  // The `\|?` matters: a multi-line union is conventionally written with a LEADING pipe
  //   export type Status =\n     | 'ready'\n     | 'blocked';
  // Without it the detector only saw single-line unions, and multi-line ones sat unreported.
  static readonly NAMED_STRING_UNION = /export\s+type\s+([A-Za-z0-9_]+)\s*=\s*\|?\s*'[^']+'(?:\s*\|\s*'[^']+')+/g;
  // Interface conventions: every interface is `I`-prefixed (IFoo) and ONE interface per file.
  static readonly INTERFACE_DECL = /export\s+interface\s+([A-Za-z0-9_]+)/g;
  // EVERY exported function/const (any casing) — the convention is `export class`, no exceptions.
  // `async` sits between `export` and `function`, so it must be optional here — without it every
  // `export async function GET` (Next route handlers) slipped through unreported.
  static readonly EXPORT_FUNC = /^export\s+(default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]*)/gm;
  static readonly EXPORT_CONST = /^export\s+const\s+([A-Za-z0-9_]+)/gm;

  /**
   * A declaration at MODULE level — column 0, so a class member (always indented) never matches.
   *
   * This is the bucket that was missing, and it is why "type/const outside the class" kept getting
   * reported by hand: `exportDebt` only ever saw EXPORTED consts and functions, so a non-exported
   * `type AccessConstraint = …` or a bare `const CACHE = new Map()` was invisible to every bucket.
   * `interface` is deliberately absent — one-per-file interfaces are the convention and `ifaceDebt`
   * already governs them.
   */
  static readonly MODULE_DECL = /^(export\s+)?(type|const|let|var|function|enum|declare)\s+([A-Za-z0-9_$]+)/gm;

  /**
   * A module-level DESTRUCTURING binding (`const { A, B } = Source;`, `const [a] = …`).
   *
   * Kept separate from `MODULE_DECL` rather than added as an alternative to its name group, because that
   * group would then also match the `{` of `export type { X } from '…'` — a re-export, not a declaration
   * (it reported 293 phantom hits in the framework alone). Restricted to `const|let|var` for the same
   * reason: only a VALUE binding can be destructured.
   *
   * This is the gap that let 25 of them accumulate across admin/ai/api while the counter read zero.
   */
  static readonly MODULE_DESTRUCTURE = /^(export\s+)?(const|let|var)\s+([{[])/gm;

  /**
   * A module-level side-effecting CALL (`DefaultAdminAppearanceBootstrap.register(x);`).
   *
   * Neither `MODULE_DECL` (which needs a declaration keyword) nor `MODULE_DESTRUCTURE` (a binding
   * pattern) can see a bare call statement, so import-time registration calls sat outside every class
   * unreported. Anchored to a Capitalized `Class.method(` at column 0: that is the shape these take, and
   * it will not match a continuation line, a lowercase local call or a chained `.then(`. Process ENTRY
   * points (`bin.ts`, `server.ts`, `*-entry.ts`) are a top-level call by definition — `isGlueOrEntry`
   * already exempts them.
   */
  static readonly MODULE_CALL = /^([A-Z][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+)+)\s*\(/gm;
  // Anchor on the `:` type-position (NOT the field name) so it also catches decorator-prefixed fields
  // (`@prop declare mode: 'a'|'b'`, `@state x: 'a'|'b'`), function params (`(mode: 'a'|'b')`), and return
  // types (`): 'a'|'b'`) — the bare-name anchor missed all of those.
  static readonly INLINE_STRING_UNION = /:\s*'[^']+'(?:\s*\|\s*'[^']+')+/g;
  // `'use client'` is a BUILD artifact of the `.client.` filename (nextor's ClientDirectivePlugin injects
  // it). It must never be typed into a source file.
  static readonly USE_CLIENT_LITERAL = /^\s*['"]use client['"]/m;
  // An interface nobody implements is not an interface — it is a data record wearing an `I`. Real
  // (PHP/AS3) interfaces are behavioural contracts a class declares with `implements`.
  // `export default <expression>` — a build tool's required entry (Vite config, Next route) must be
  // GENERATED by nextor, never authored. `export default function` is already covered by OopGuard.FC.
  static readonly EXPORT_DEFAULT_EXPR = /^export\s+default\s+(?!function\b|class\b)\S/m;
  // Module-level `const`/`let` — state and constants belong to a class, not to a module.
  static readonly TOP_LEVEL_BINDING = /^(?:const|let)\s+[A-Za-z_$][\w$]*\s*[:=]/gm;
  // `type X = ...` aliases: a data shape is an interface, a closed set is an Enum.
  static readonly TYPE_ALIAS = /^(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*=/gm;
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
  // `export default class` — Next/Vite required default exports are generated by nextor, not authored.
  static readonly EXPORT_DEFAULT_CLASS = /^export\s+default\s+class\b/gm;

  static readonly CLASS_HEAD = /^export\s+(?:abstract\s+)?class\s+(\w+)([^{]*)\{/gm;
  // A class is REAL (not a data record) when its body shows any of: behaviour, a DECORATED member
  // (runtime metadata — entity columns), a field INITIALISER, or an access modifier. Learned the hard
  // way: decorators are illegal on an interface, and an initialiser/modifier cannot survive one either.
  static readonly CLASS_BEHAVIOUR = /\b(constructor\s*\(|static\s|get\s+\w+\s*\(|set\s+\w+\s*\(|async\s|render\s*\(|\w+\s*\([^)]*\)\s*[:{])|^\s*@\w|^\s*(?:private|protected|public)\s|[:?][^;\n]*=\s/m;

  static readonly IMPLEMENTS_CLAUSE = /\bimplements\s+([A-Za-z0-9_,\s<>.]+)/g;


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
    if (OopGuard.EXEMPT_PACKAGES.has(pkg)) continue;
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
      for (const m of code.matchAll(OopGuard.IMPLEMENTS_CLAUSE)) {
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
    const allow = OopGuard.ALLOW_PACKAGES.has(pkg);
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
      if (OopGuard.REACT_IMPORT.test(src)) found.push(`${rel}: non-type import from 'react'`);
      if (OopGuard.BUILTIN_HOOK.test(src)) found.push(`${rel}: React hook call`);
      else if (file.endsWith('.tsx') && OopGuard.CUSTOM_HOOK.test(src)) found.push(`${rel}: custom hook invocation (use<X>())`);
      if (OopGuard.RAW_REACT.test(src)) found.push(`${rel}: raw React escape hatch (createElement/forwardRef/createContext/memo/…)`);
      // Next route files (page/layout/route/loading/error/not-found/template/default/global-error) MUST
      // default-export a component and async server components can't be classes — the thin function shim there
      // is framework-required, so skip the OopGuard.FC check for them (hooks / raw-React are still flagged).
      const isNextRouteFile = /(^|\/)(page|layout|route|loading|error|not-found|template|default|global-error)\.(tsx|ts)$/.test(rel);
      if (file.endsWith('.tsx') && !isNextRouteFile && OopGuard.FC.test(src)) found.push(`${rel}: 'export const/function <Capitalized>' or React.FC (function component)`);
      // Soft-warn only.
      if (OopGuard.PROPS_GENERIC.test(src)) bucket.warnings.push(`${rel}: <Props, State> generic — @prop/@state should carry it [soft]`);
      // Enum-debt (non-fatal): closed-string unions that must become reactor Enums.
      for (const m of src.matchAll(OopGuard.NAMED_STRING_UNION)) bucket.enumDebt.push(`${rel}: named union '${m[1]}'`);
      for (const m of src.matchAll(OopGuard.INLINE_STRING_UNION)) bucket.enumDebt.push(`${rel}: inline union ${m[0].trim().slice(0, 48)}`);
      // Interface-debt (non-fatal): non-`I`-prefixed names + >1 interface per file.
      const ifaces = [...src.matchAll(OopGuard.INTERFACE_DECL)].map((m) => m[1]);
      for (const nm of ifaces) if (!/^I[A-Z]/.test(nm)) bucket.ifaceDebt.push(`${rel}: interface '${nm}' not I-prefixed`);
      // Generated files (nextor RoutePlugin output) are build artifacts, not authored source — their
      // `export default function` IS the Next bridge. The authored `*.class.*` sibling is what counts.
      const isGenerated = /^\/\/ GENERATED by (@fromcode119\/)?nextor/m.test(raw.slice(0, 200));
      // Strip template literals / block comments so codegen TEMPLATES aren't counted as real exports.
      const codeOnly = src.replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``').replace(/\/\*[\s\S]*?\*\//g, '');
      if (!isGenerated) for (const m of codeOnly.matchAll(OopGuard.EXPORT_FUNC)) bucket.exportDebt.push(`${rel}: export ${m[1] ? 'default ' : ''}function ${m[2] || '(anonymous)'}`);
      if (!isGenerated) for (const m of codeOnly.matchAll(OopGuard.EXPORT_CONST)) bucket.exportDebt.push(`${rel}: export const ${m[1]}`);
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
      // non-OOP glue layer (reactor/nextor/typor/archor), and for process ENTRY POINTS, whose whole job is
      // a top-level call — there is no class for `APIServer.bootstrap()` to live in.
      if (!isGenerated && !OopGuard.isGlueOrEntry(rel) && !OopGuard.LOAD_BEARING_TYPES.has(rel.replace(/\\/g, '/'))) {
        for (const m of codeOnly.matchAll(OopGuard.MODULE_DECL)) {
          bucket.moduleDecl.push(`${rel}: module-level ${m[2]} '${m[3]}' outside a class`);
        }
        for (const m of codeOnly.matchAll(OopGuard.MODULE_DESTRUCTURE)) {
          bucket.moduleDecl.push(`${rel}: module-level ${m[2]} ${m[3]}…${m[3] === '{' ? '}' : ']'} destructuring outside a class`);
        }
        // A module that exports NOTHING exists only for its side effects — that is structurally a
        // bundle entry (`tracker.ts` self-registers a plugin client and returns nothing), and there is
        // no class form for it. Detected from content rather than a path allowlist, so it stays
        // self-maintaining; a file that gains an export is measured again from that moment.
        if (/^export\s/m.test(codeOnly)) {
          for (const m of codeOnly.matchAll(OopGuard.MODULE_CALL)) {
            bucket.moduleDecl.push(`${rel}: module-level call '${m[1]}(…)' outside a class`);
          }
        }
      }
      // `'use client'` belongs to the `.client.` FILENAME, injected by nextor at build time — never source.
      if (OopGuard.USE_CLIENT_LITERAL.test(raw)) bucket.clientDebt.push(`${rel}: 'use client' literal in source`);
      // An interface no class implements is a data record, not a contract — model it as a class.
      for (const m of codeOnly.matchAll(OopGuard.INTERFACE_DECL)) {
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
        for (const m of codeOnly.matchAll(OopGuard.EXPORT_DEFAULT_CLASS)) bucket.defaultClass.push(`${rel}: 'export default class' (generate the default via nextor)`);
        if (OopGuard.EXPORT_DEFAULT_EXPR.test(codeOnly) && !OopGuard.ownsItsDefaultExport(rel)) {
          bucket.defaultExport.push(`${rel}: 'export default <expression>' (generate it via nextor)`);
        }
        for (const m of codeOnly.matchAll(OopGuard.TOP_LEVEL_BINDING)) bucket.topLevel.push(`${rel}: module-level '${m[0].trim().slice(0, 40)}' (move into the class)`);
        for (const m of codeOnly.matchAll(OopGuard.TYPE_ALIAS)) bucket.typeAlias.push(`${rel}: type alias '${m[1]}' (interface, or reactor Enum)`);
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
      else if (OopGuard.ALLOW_FILES.has(rel) || OopGuard.ALLOW_FILES.has(relKey)) bucket.warnings.push(...found.map((v) => `${v} [allowlisted — hook API / false positive]`));
      else bucket.violations.push(...found);
    }
  }
  
  
    return perPackage;
  }
}

/**
 * The OOP guard's RATCHET DATA: how many violations each area is allowed to still have, which files are
 * exempt, and which type-level constructs are load-bearing.
 *
 * Split out of OopGuard (669 lines) 2026-09-09. It is ~200 lines of pure data that changes on a
 * different cadence from the rules that read it — every paid-off violation edits this file and nothing
 * else. Numbers may FALL, never rise.
 */
export class OopGuardBaselines {
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
    plugins: 2,
    themes: 1,
    appearance: 0,
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
    plugins: 0,
    themes: 0,
    appearance: 0,
  };


  static readonly MODULE_DECL_BASELINE: Record<string, number> = {
    framework: 0,
    // Re-set when `isTypeLevelOnly` was retired: the bucket now counts EVERY module-level `type`, not
    // only object shapes and string unions, so these are the same debt measured more strictly.
    plugins: 0,
    themes: 0,
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
}

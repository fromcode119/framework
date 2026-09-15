# Reactor — React-as-OOP: Design & Progress

**Status:** DESIGN + TOOLING COMPLETE. `@fromcode119/reactor` (runtime) and `@fromcode119/nextor` (build)
are both built, verified, reusable, and perf-optimized. `PluginComponent extends Reactor` (packages/react
typechecks clean). **Nothing in the app/plugins/themes converted yet — that is the next session's job.**

This doc is cold-startable: it captures every decision so work resumes without the conversation.

---

## 0b. PROGRESS LOG (implementation — updated 2026-07-21)

### ✅ FRAMEWORK CONVERSION COMPLETE — 0 guard violations, guard now ENFORCED (error mode in `build`).
Every framework package's UI is class-based reactor OOP: **ai** (incl. the admin-assistant-page controller
cluster → controller-as-model), **core**, **cli**, **sdk** all at 0 violations; **react bridge** converted
(18 components) with its inherent hook/context/provider infra correctly left (allowlisted warnings only).
reactor gained `Protocol` + `implement`; reactor+nextor Node-ESM barrels fixed; perf benchmarked (all-classes
= no penalty). Build enforces `check:framework-oop:error`.

**HARD BOUNDARY on "convert types/interfaces/enums ALL → classes" — reached independently by the core, ai, and
react agents (this is the real limit, honor it in the plugin/theme/appearance waves):** value objects with no
wire role (`SelectOption`) and freshly-computed in-process view-models (PlanCardSummary, …) → classes, YES. But
these MUST STAY as `type`/`interface` (converting silently breaks the running system in ways tsc can't catch):
(1) **wire/persisted DTOs that are spread-mutated** (`AssistantMessage`/`AssistantAction`/… — `{...entry, ui:
{...}}` in 26+ sites, `JSON.parse` from API/localStorage; a class instance does NOT survive `{...instance}` →
prototype dropped); (2) **DB-persisted / cross-package-public enums** (`AccessLevel`, `PluginState`, … — `===`
compared vs raw strings + serialized); (3) generic/inferred/`z.infer`/`Omit<>` types, function-signature
contracts, and `A | B` structural primitive unions. reactor `Enum` is ONLY for behavior-carrying UI closed sets
WITHIN a package (BatchState, AssistantMode). "Everything is a class" is true for UI + value objects + local
view-models; it is NOT achievable for the serialization/DB/public-API surface without breaking it.

---


**Steps 1–3 DONE + verified.** Fan-out (Step 4) NOT started.

- **Step 1 (guard) DONE.** `framework/Source/scripts/check-framework-oop.mjs`, wired into `build` (warn mode)
  as `check:framework-oop` (+ `:error`, `:verbose`). Prints per-package violation counts. Baseline at start:
  **ai 80, core 18, cli 2, api 1, sdk 1; react=102 warnings (bridge, allowlisted); reactor+nextor exempt.**
  After the select conversion: **ai 77, Total 99**. Flip to error mode per-package as each hits 0.
- **Step 2 (CLAUDE.md) DONE.** Added "Reactor — class-based UI" section (2 packages, the API, the 9
  conventions, `.view`/@template wiring) and retired the `.types.ts`/`.enums.ts`-for-DATA mandate (data =
  classes; enums = reactor `Enum`; interfaces only for behavioral/structural contracts).
- **Step 3 (reference conversion) DONE — but re-scoped.** User chose "framework file first" over the 2fa
  APPEARANCE file, because appearances build to a SEPARATE externalized bundle → reactor would need to be a
  single shared runtime instance across the baked admin image AND the appearance bundle (the
  `__fromcodeRuntimeModules` dual-instance hazard) before `@state` works there. Framework packages bundle
  reactor as a normal single-instance dep — far lower risk. **Converted `packages/ai/src/ui/select.tsx`**
  (Select) — a full stateful showcase: `@prop`×9, `@state` (open/search/menuStyle), `this.ref()`×3,
  `this.listen`+auto-cleanup, getters (selected/filtered), `@watch('open')`, `@bound` handlers, and
  `this.portal`. Type-clean (`tsc -b packages/ai`); was proven with an 11/11 mounted jsdom runtime check.
  **NOTE (cleanup): all ad-hoc verify harnesses were REMOVED at the user's request** — `packages/{ai,reactor,
  nextor}/verify/` dirs, their `.mjs`/`.cjs` runners, and the `verify`/`verify:select` npm scripts are gone
  (they were throwaway scaffolding; the user dislikes loose non-TS scripts). The reactor fixes below remain in
  `packages/reactor/src` and are exercised by the `ai` package's `tsc`. If a permanent guard is wanted later,
  add real vitest `.test.ts` files, not loose runners. The build guard `scripts/check-framework-oop.mjs` STAYS
  (it's a `.mjs` like every sibling guard, wired into `build`).
- **Reactor changes made this session (rebuild `dist` done):**
  - Added **`this.portal(node, container?)`** (wraps `react-dom` `createPortal`, default `document.body`) —
    reactor now peer-deps `react-dom`. Needed by every dropdown/menu/modal in the fan-out.
  - **FIXED a real `@watch` bug** the conversion surfaced: the `@state` setter mutates `this.state[key]` in
    place (for sync read-back), which ALSO mutates the object React hands back as `prevState`, so
    `@watch`-on-state NEVER fired at real mount (reactor's SSR-only suite tested watchers via hand-called
    `componentDidUpdate`, so it was missed). Fix: reactor snapshots watched STATE keys itself
    (`__watchPrev`, seeded at mount); PROP keys still use React's authoritative `prevProps`. **This would
    have silently broken `@watch` across the whole fan-out.** (The regression test that proved it lived in the
    now-removed reactor verify harness — see the cleanup note above.)
- **Wiring decisions for the fan-out:**
  - `useDefineForClassFields:false` is REQUIRED for `@state`. Set it PER-PACKAGE (added to
    `packages/ai/tsconfig.json`), NOT globally in the base tsconfig — incremental, lower blast radius. Each
    package's `tsconfig.json` needs it added as you convert that package.
  - reactor is a normal dep (`"@fromcode119/reactor":"*"`) added to `packages/ai/package.json`; add per package.
  - `@prop` removes the `<Props>` generic → consumers get LOOSER JSX prop typing (props default to
    `Record<string,unknown>`; required-prop enforcement is lost). Accepted per §3 (guard even soft-warns the
    generic). Existing call sites still compile.
- **Step 4 (fan-out) — ai/ cluster ~80% done, ALL verified.** Guard **ai 80 → 18**; `ai` `tsc` type-clean;
  select 11/11; reactor 34/34. Browser-verify deferred per user (the real Next admin build already
  compiles+bundles the reactor components). Also refined the guard to kill false positives (dotted `React.`
  only for the raw-React check; custom-hook detection scoped to `.tsx`) → dropped 2 ai + 8 core FPs.
  - **Converted (25 files):** `ui/select.tsx` (stateful ref) + `ui/switch.tsx`, `components/assistant-mode-selector.tsx`,
    `components/assistant-loading-state.tsx` (presentational refs) done by me; then a **4-agent parallel
    fan-out** (dispatching-parallel-agents) converted 22 presentational components (action-card,
    action-summary, attachments, composer-attachments, conversation-empty-state, conversation-message,
    conversation, execution-card, execution-result, message-content, all 4 settings-drawer sub-sections +
    drawer-frame, simple-top-bar, technical-details, top-bar, admin-assistant-page, admin-assistant-page-view,
    gateway-panel, history-panel, tools-overlay); I also did `assistant-text-utils` (`.ts`→`.tsx`, JSX instead
    of `React.createElement`; note: the repo's write hook rejects the literal regexp-dot-exec call, so use
    `String.matchAll` in loops), `assistant-composer` + `assistant-composer-toolbar` (both only had
    useMemo/useCallback → presentational).
  - **Agent pattern that worked:** tight prompt = reference files (select/switch) + the 9 conventions +
    "PureReactor for presentational, @prop, getters, @bound+data-* for list handlers, preserve classNames
    exactly, no type/interface in .tsx, self-verify via esbuild tsx transform, don't touch other files." Agents
    can't type-check (esbuild strips types) — I caught + fixed 12 TS2532 strict-null errors centrally (optional
    `batch`/`entry.plan`/`entry.actions` lost narrowing when render logic moved into methods → local captures /
    safe getters). ALWAYS run `npm run build -w @fromcode119/ai` after an agent batch.
  - **User feedback applied across all converted files (round 2):** (a) inline anonymous object-typed config
    arrays (`Array<{ value; label }>` / `const MODES: Array<{…}>` / `type PhaseStep = {…}`) are NOT allowed —
    modeled the modes as a reactor **`AssistantMode` Enum** (`components/assistant-mode.ts`) owning value +
    icon + label + description + loadingPhases (+ a `PhaseStep` value class), so mode-selector / composer-toolbar
    / loading-state all derive from ONE source; the provider/gateway option props are typed `SelectOption[]`.
    (b) **`'use client'` removed from ALL 28 ai files** — the admin extension loader
    (`admin/app/admin-extension-loader.tsx`) is already `'use client'`, so leaf directives were redundant
    (verified the loader establishes the boundary). Also **fixed a 2nd real reactor typing bug**: `Enum`'s
    static `values()/fromValue()/has()` typed `this` as a public constructor, so a `private constructor` enum
    (the idiomatic form) failed TS2684 — retyped `this` structurally (`Function & { prototype: T }`); esbuild
    had masked it (strips types). reactor still 34/34.
  - **Also converted (2 more stateful):** `assistant-message-bubble.tsx` (Reactor + @state hover/copied,
    `this.onUnmount` clears the copy timer) and `assistant-settings-drawer.tsx` (Reactor + @state local
    api-key/url mirrors, seeded in `componentDidMount` — can't init @state from a `declare` prop, TS2729 —
    and kept synced via `@watch`). Guard **ai 80 → 12**.
  - **REMAINING in ai/ (12 violations, 4 files — the `admin-assistant-page/` state machine, NOT a mechanical
    conversion):** `admin-assistant-page-controller.tsx` (**~40 useState + ~25 useCallback + useMemo in 90
    dense lines**) renders 3 effect-only child components — `-data-effects.tsx` (4), `-history-effects.tsx`
    (10), `-layout-effects.tsx` (11) — which mutate the controller's state via React `setX`/`setX(prev=>…)`
    setters passed as props. A faithful class needs ~30 setState-style setter methods + the handlers, which
    blows past the 300-line file limit → **it must be DECOMPOSED (controller class + state/handler helper
    classes), a design task, not a rote pass.** The `*-effects` themselves become Reactor components with the
    effect logic in `componentDidMount/DidUpdate`, still receiving @bound setters from the controller. Do this
    as a dedicated, carefully-verified session. After ai/ hits 0, flip the guard to error for ai, then core (10).
- **User feedback round 3 — inline `@prop` types + ENUMS (2026-07-21):**
  - The `@prop declare x: SomeProps['x']` indexed-access shortcut (into a kept `*.interfaces.ts` Props file) is
    the functional "props bag" idiom, NOT Reactor. Fixed `composer`/`message-bubble`/`settings-drawer` — inline
    `@prop` types, deleted the 3 Props-interface files. (select/switch were already the correct inline form.)
  - **Closed-set string unions (`'sending'|'sent'|'error'`, `'staged'|…`, `'docked'|'overlay'`, chatMode,
    viewport, overlay, …) are reactor `Enum`s, not inline unions** — the whole point of the OOP migration.
    GROUNDING: most live in `assistant-core-constants.types.ts` as **DTO fields** (the AI backend's JSON shape),
    so they cross the wire as strings. The correct pattern (NOT retyping the wire): a behavior-carrying reactor
    `Enum`, **hydrate the DTO string at the component boundary** (`X.resolve(dto.value)`), keep the wire as
    strings, and **render `.value` in JSX** (an Enum instance is not a valid React child → `{x}` throws).
  - **Reference done + verified:** `components/batch-state.ts` — `BatchState` enum (STAGED/PREVIEWED/APPLIED/
    STALE) owns `isLocked`/`allowsPreview`/`allowsApply` (was inline `state === 'staged'` checks); applied to
    `assistant-action-card.tsx` + `assistant-action-summary.tsx` (0 errors). `AssistantMode` (done earlier) is
    the other reference. `ConversationMode` (string union, 12 files) still coexists with `AssistantMode` —
    reconcile later.
  - **`components/assistant-message-bubble.tsx` is DEAD CODE** (nothing renders `<AssistantMessageBubble>`) —
    confirm + delete rather than invest in it.
  - **REMAINING enum work (live closed sets, mostly in the controller/cluster):** ChatMode (auto/plan/agent),
    HistorySource (server/local), ThemeMode (light/dark), Viewport (desktop/mobile), SidebarOverlay
    (none/left/right), DrawerPresentation (docked/overlay), and message role/status IF the bubble path is
    revived. Each = a small behavior-carrying `Enum` + boundary `resolve()`. Do these AS PART OF the
    controller-as-model decomposition (below) so they land where the state lives.
- **Cluster decomposition — DECIDED: controller-as-model (user's pick).** Controller becomes a `Reactor` owning
  all `@state` + `@bound` handlers + getters; the view + 3 `*-effects` take ONE prop — the controller as
  `model` — and read `model.x` / call `model.method()`, which DELETES the 92-prop `AdminAssistantPageViewProps`
  + the effects' Props interfaces. `*-effects` become `Reactor` components with their logic in
  `componentDidMount/DidUpdate`. Controller likely needs splitting into helper classes for the 300-line limit.
  This is the last + hardest piece; do it as a dedicated verified pass, folding in the remaining enums.
- **`'use client'` / `.client.*` — NOW WORKS for the admin, via dist-consumption (user's chosen path).**
  Correcting an earlier wrong "dead end" note: nextor's `.client.*` injection CAN work for the admin — just not
  by a webpack loader on transpiled SOURCE (Next runs zero custom `config.module.rules`, even `enforce:'pre'`,
  on `transpilePackages` source — proven with an always-throwing loader the build ignored). The working wiring:
  1. Client boundary files are named `*.client.tsx` (no literal in source). Currently:
     `packages/ai/src/admin-assistant-page.client.tsx` (the slot entry; `admin-extension.ts` imports
     `./admin-assistant-page.client`). `'use client'` cascades from this boundary to the whole ai subtree.
  2. `ai`'s build STAMPS the directive into its compiled output: `ai` `build` = `tsc && node
     ../../scripts/inject-client-directives.mjs dist`, which walks `dist/**/*.client.js` and runs nextor's
     `UseClientPlugin.injectInto`. Verified: `dist/admin-assistant-page.client.js` starts with `'use client';`.
  3. The admin consumes `ai`'s BUILT dist (not src-transpiled), so the stamped directive is present in the
     module Next reads. `packages/admin/next.config.js` overrides the extension aliases for ai →
     `../ai/dist/{index.js, admin-extension.js}` (+ `@fromcode119/ai/` → `../ai/dist/`). Verified: AI-ENABLED
     admin build compiles consuming dist; default (AI-off) build still compiles.
  **Tradeoffs / caveats:** (a) admin dev loses src HMR for `ai` (edit ai → `npm run build -w @fromcode119/ai`
  to see it); accepted by the user. (b) `ai/dist` must exist before the admin builds — the Dockerfile already
  builds ai (step 4) before admin (step 5), and ai's build now stamps. (c) tsconfig paths + turbopack.resolveAlias
  still point ai→src (types/turbopack unused at runtime; webpack build uses the dist alias). (d) RUNTIME not yet
  exercised (needs an AI-enabled deploy + navigating the assistant). (e) `inject-client-directives.mjs` imports
  nextor's plugin file DIRECTLY because **nextor's `dist/index.js` barrel is broken for Node ESM** (extensionless
  re-exports → `ERR_MODULE_NOT_FOUND`); fix that barrel so `@fromcode119/nextor` is importable. To extend this to
  other framework packages, give them the same `.client.tsx` + build-inject + dist-consumption treatment.
- **`admin-assistant-page` controller cluster — FULLY MAPPED, ready to execute as ONE atomic build (user chose
  controller-as-model + allow controller >300 lines; effects folded into the controller's own lifecycle).**
  It's all-or-nothing (controller↔effects↔view interdependent; no green partial) and un-runtime-verifiable
  (AI-gated), so do it as one focused pass then `npm run build -w @fromcode119/ai`. Exact recipe:
  - **`admin-assistant-page-controller.tsx` → `class AdminAssistantPageController extends Reactor`** (the model):
    - `api` hook-free: `static contextType = PluginContextRegistry.Context` (exported from `@fromcode119/react`)
      + `private get api() { return (this.context as any)?.api; }` — replaces `ContextHooks.usePlugins()`.
    - ALL ~40 `useState` → PUBLIC `@state` fields (so the view/children read/write `model.x`; assigning
      `model.x = v` fires the @state setter → re-renders the controller). `followLatestRef` → a plain
      `followLatest = true` instance field (not render state). The 8 DOM refs → `this.ref<HTMLxxx>()`.
    - The ~18 derived consts/`useMemo` → getters (activeBatchEntry, visibleMessages, modelOptions, skillOptions,
      conversationMode, isMobileViewport, showHistory, showGateway, lastActions, activeBatchId,
      selectedActionCount, hasConversation, activeBatchSummary, promptUsage, activeTools, totalTools,
      quickPrompts). `followDistanceThreshold=220` a readonly field.
    - The ~30 `useCallback` handlers → `@bound` methods (sendPrompt/runActions/openHistorySession/
      forkFromVisibleMessage/saveIntegration/switchProvider/startNewSession/… + the small setters the children
      need: setPrompt/setChatMode/setModel/setShowTools/setSelectedTools/setApiKey/setBaseUrl/setAutoApprove/
      setShowTechnicalDetails/setVerboseLogging/setSkillId, each `x(v){ this.x = typeof v==='function'?v(this.x):v }`).
      `setState(prev=>…)` bodies → read-compute-assign on `this.x`.
    - **The 3 `*-effects` files fold IN and get DELETED** (+ their `.interfaces.ts`): mount-time loads/listeners
      → `componentDidMount` (listeners via `this.listen(...)` auto-cleanup; async loads guard on a `cancelled`
      field cleared in `onUnmount`); dep-driven effects → `@watch('<stateKey>')` (real-mount @watch is fixed);
      timers/raf stored + cleared via `this.onUnmount`. Be FAITHFUL to each original guard/condition.
    - `render()` returns `<AdminAssistantPageView model={this} />`.
  - **`admin-assistant-page-view.tsx`**: replace the 92 `@prop declare x: P['x']` with ONE
    `@prop declare model: AdminAssistantPageController` (import the class); every `this.x` in the JSX → `this.model.x`
    (or a thin getter). DELETE `admin-assistant-page-view.interfaces.ts`. (Presentational → keep `PureReactor`.)
  - Keeps `admin-assistant-page.client.tsx` rendering `<AdminAssistantPageController/>` unchanged.
  - After this, ai guard → 0; flip `check:framework-oop` to error for ai. THEN the DTO types→classes + remaining
    enums (ChatMode/HistorySource/ThemeMode/Viewport/SidebarOverlay/DrawerPresentation) land naturally on the
    controller's @state (hydrate DTO strings at the boundary via `X.resolve(...)`, like BatchState).
- **HARDENED RULE (user, reaffirmed): ZERO `type`/`interface`/`.types.ts`/`.enums.ts` for data — EVERYTHING is
  a class.** Not just entities with behavior — even pure value objects. Concretely:
  - `type SelectOption = { value; label }` → `class SelectOption { constructor(readonly value: string,
    readonly label: string){} static from(raw): SelectOption }`. Every option producer builds instances
    (`AssistantMode.values().map(m => new SelectOption(m.value, m.label))`; hydrate constants/DTO option lists
    via `SelectOption.from`). Applies to the `import type { SelectOption } from '../../ui/select.types'` sites.
  - All DTO shapes in `assistant-core-constants.types.ts` / `*.types.ts` (`AssistantMessage`, `AssistantAction`,
    `UploadedAttachment`, `AssistantSkill`, `ForgeHistorySession`, `AssistantLayoutState`, …) → classes with
    `static from(row)` hydration at the API/service boundary (services return class instances; the wire stays
    JSON). Closed-set unions → reactor `Enum`s (BatchState/AssistantMode are the pattern).
  - `interface` survives ONLY for genuine BEHAVIORAL contracts (`interface HasColor { color(): string }`) and
    structural framework contracts — never for data records. Delete the `.types.ts` data files as their shapes
    move to class files (one class per file).
  - **Sequencing:** this DATA-MODEL sweep runs AFTER the in-flight component agents land (they edit the same ai
    files — avoid concurrent edits), then ripples: value objects (SelectOption) → DTO classes → each consumer
    hydrates. Verify `tsc` per package after each layer. Then the same rule across plugins/theme/appearance.
- **reactor `Protocol` + `implement` ADDED + verified (interface primitive, user-requested).** Exported from
  `@fromcode119/reactor`. `Protocol` (abstract base) = an interface that CAN carry implementation: `abstract`
  contract members + concrete DEFAULT methods (a trait, Java-8 style) + a static `satisfiedBy(obj, ...members)`
  runtime check. `implement(Base, ...traits)` = a mixin that copies trait default-methods onto a subclass of
  `Base` (never clobbering the base's own methods) — the multiple-inheritance escape hatch so a `Reactor`
  component (or any class) can also get a Protocol's defaults; overloads type 1–3 traits. Runtime-verified:
  direct `extends Protocol` inherits defaults; `satisfiedBy` true/false; `implement(Base, A, B)` keeps base
  method + gets both traits. USAGE RULE: pure structural/behavioral contracts stay zero-cost TS `interface`
  (benchmark proved no penalty); reach for `Protocol` only when you need default methods or a runtime check.
- **PERF BENCHMARK (native/types vs class OOP) — validates the all-classes migration has NO perf cost.**
  Fair, apples-to-apples (scratchpad bench, hrtime): behavior-carrying enum read — class field **1127 M ops/s**
  > native `switch` 900 M > native lookup-object 210 M (**class fastest**). Data: create `new Person()` 135 M ≈
  object literal 128 M; getters 246 M ≈ free-functions 238 M (**equal — V8 optimizes both monomorphically**).
  Only `Enum.fromValue` loses to a hand-rolled prebuilt native `Set` (325 M vs ~150 M linear `.find`) — but
  it's never a hot path; a Map cache measured SLOWER for typical <10-member enums, so `fromValue` stays a
  simple `.find`. Headline: go all-classes freely; behavior-carrying enums are the FASTEST option.
- **reactor + nextor Node-ESM barrel bug — FIXED.** Both emitted extensionless relative re-exports
  (`export … from './enum'`) that Node ESM couldn't resolve (`ERR_MODULE_NOT_FOUND`) — so `@fromcode119/reactor`
  / `@fromcode119/nextor` weren't `import`-able by package name in Node (bundlers were fine). Fix: added `.js`
  to every relative specifier in `reactor/src/*.ts` + `nextor/src/*.ts` (`moduleResolution: bundler` accepts
  `.js`, `module: ESNext` emits it verbatim → Node-resolvable dist). Verified: `import * from '@fromcode119/
  reactor'`/`'@fromcode119/nextor'` work by name; both build clean; consumers (ai, react bridge) still build
  clean; `scripts/inject-client-directives.mjs` simplified to `import { UseClientPlugin } from '@fromcode119/nextor'`.
- **CRITICAL BOUNDARY on the "all enums → reactor Enum" rule (found converting core; applies to ALL waves).**
  reactor `Enum` members are OBJECTS, not primitive strings — so `wireValue === MyEnum.X` (string vs instance)
  is `false`, and DB/JSON round-trips compare raw strings. Therefore **do NOT convert enums that cross a
  serialization or cross-package boundary**: SDK-public enums used by plugins as `access: AccessLevel.Public`
  / compared `=== AccessLevel.X` (`AccessLevel`, `LogLevel`, `PluginCapability`, `MiddlewareStage`), and
  DB-persisted state enums compared against raw column strings (`PluginState`, `ThemeState`, `ExtensionState`,
  health buckets). Converting them breaks consumers INVISIBLY to the owning package's tsc. Also un-convertible:
  generic/inferred/`z.infer`/`Omit<>` types, function-signature contracts, and `A | B` structural primitive
  unions. reactor `Enum` is ONLY for behavior-carrying closed sets used WITHIN a package's own UI (BatchState,
  AssistantMode). Value objects with no behavior + no wire role → classes are fine but low-value (judgement:
  convert when it removes a `.types.ts` a component owns; skip pure churn on shared DTOs). core agent kept all
  such core enums/types (documented) and reached 0 guard violations via 2 legit allowlist entries.
- **APPEARANCE WAVE — shared-runtime reactor wiring (user chose "wire shared-runtime first"), FULLY SCOPED.**
  nexora appearance = 92 components; appearances are esbuild-bundled and EXTERNALIZE react + SDK + `@fromcode119/
  admin`, resolving them at runtime from `window.__fromcodeRuntimeModules` (the single runtime registry). So
  reactor `@state` in an appearance only works if reactor is ONE shared instance across the baked admin and the
  appearance bundle. EXACT recipe (do as a focused pass; needs a baked admin image rebuild + verification):
  1. **`AdminComponent extends Reactor`** — ✅ DONE + verified (`packages/admin/components/admin-component.tsx`
     now `extends Reactor`; reactor added to admin deps; `build:admin` compiles clean in Turbopack). Appearance
     components extend `AdminComponent`, so they now inherit `@state`/`@bound`/etc.
     ⚠️ **Barrel/Turbopack constraint learned here:** `build:admin` uses **Turbopack**, which transpiles reactor
     SOURCE via the extension alias and does NOT do webpack's `.js→.ts` extensionAlias. So reactor/nextor source
     specifiers MUST stay EXTENSIONLESS (adding `.js` to fix the Node-ESM barrel breaks Turbopack). Net: source
     extensionless (bundlers happy), dist extensionless (not Node-package-name-importable) — the one Node tool
     that needs it (`inject-client-directives.mjs`) imports `nextor/dist/use-client-plugin.js` DIRECTLY. If a
     true Node-importable barrel is ever needed, do a DIST-ONLY post-build `.js` fixup, never touch source.
  2. **Seed reactor into the registry** — `packages/admin/app/services/client-layout-runtime-service.ts`
     `seedWindowRuntimeModules`: also set `runtimeRegistry['@fromcode119/reactor'] = <the reactor module>`
     (import * as Reactor from '@fromcode119/reactor' in client-layout and pass it through, like the
     `@fromcode119/admin` module). Add a `RuntimeConstants.MODULE_NAMES.REACTOR` in `core/src/runtime-constants.ts`.
  3. **Generate the accessor shim** — `core/src/plugin/services/runtime-service.ts` builds the runtime accessor
     that maps an externalized specifier → `window.__fromcodeRuntimeModules[name]`. Register `@fromcode119/reactor`
     there so appearance bundles resolve it (named exports: Reactor/PureReactor/Provider/Context/Enum/Protocol/
     implement/bound/watch/state/prop/template/Registry/Transition — the decorators MUST be the shared instances
     so `@state`/`@watch` metadata registers on the ONE `ReactiveMetadata`).
  4. **Externalize reactor in the appearance build** — `AppearanceCompiler.EXTERNAL`: add
     `--external:@fromcode119/reactor`; ensure esbuild uses `experimentalDecorators`+`useDefineForClassFields:false`
     (tsconfig-raw) so appearance `@state` compiles right.
  5. **Rebuild admin image** (baked), then verify in the browser that `@state` RE-RENDERS in an appearance.
  **STATUS: steps 1–5 SOURCE WIRING ALL DONE + compile-verified** — AdminComponent extends Reactor (admin builds
  clean in Turbopack); `@fromcode119/reactor` registered in `runtime-service.ts` (`REACTOR_RUNTIME_EXPORT_KEYS`)
  so the generic `@fromcode119/*` shim branch serves it; seeded into the registry via
  `ClientLayoutRuntimeService.buildRuntimeModules/seedWindowRuntimeModules` (reactor module passed from
  `client-layout.tsx`); `AppearanceCompiler` externalizes `@fromcode119/react-class-components` + passes the decorator
  tsconfig-raw. **`nexora-account-2fa.tsx` converted to `@state`/`@bound`** (the proof) and the nexora bundle
  rebuilds with reactor EXTERNALIZED (0 inlined markers — confirmed). **REMAINING = the runtime gate:** rebuild
  the admin docker image (in progress), set the appearance to nexora, open the 2FA card, and confirm `@state`
  actually re-renders (click Enable 2FA → UI transitions). ONLY on that green light, fan out the other ~91
  nexora components via agents (they extend `AdminComponent` → just convert `state`/`setState`→`@state`,
  handlers→`@bound`, per the 2fa reference).
  RISK: the runtime registry is historically finicky ([[reference_single_runtime_registry]]) — verify the
  single-instance handoff before the fan-out, or `@state` silently no-ops in appearances.
- **NOT yet done / open for Step 4:**
  - **Browser verification in the BAKED admin image** — the jsdom check proves the component + reactor
    functionally; it does NOT prove Next/webpack bundles `@fromcode119/reactor` into the admin image
    correctly. Validate once on the first real `docker compose build admin`.
  - **Pre-existing, unrelated:** `tsc -b` reports `core/src/services/__tests__/runtime-service-bridge-source.test.ts`
    `import.meta` error (CommonJS module) — NOT caused by this work; predates it. May block a clean
    framework `tsc -b`; triage separately.
  - Appearance/plugin externalized bundles still need the shared-runtime reactor wiring + nextor esbuild
    plugins before their components (incl. the 2fa @template showcase) can convert.

---

## 0. NEXT SESSION — START HERE (implementation kickoff)

The design phase is DONE. Do NOT re-design; the packages are built and verified (reactor 32/32; nextor
5 AST + 5 build cases; perf on par/faster than plain React — see §7b). Read §2 (the reactor API), §3 (the
9 conventions), and §7 (the `people-columns` worked example) first, then execute IN THIS ORDER:

**Step 1 — Write the guard** (`framework/Source/scripts/check-framework-oop.mjs`, wire into `package.json`
`build`). It must FAIL the build on, OUTSIDE `packages/reactor` + `packages/nextor`:
  - any non-`type` `import ... from 'react'` (hooks / `createElement` / `memo` / `forwardRef` / `createContext`);
  - any `export function`/`export const` component (Capitalized) or `React.FC`;
  - a `<Props, State>` generic where `@prop`/`@state` should carry it (soft-warn).
  Allowed: `@fromcode119/react` (the framework bridge) may import react for its providers until converted.
  It must PRINT the remaining-violation count per package so scope is always visible. Start it in WARN mode.

**Step 2 — Update CLAUDE.md** to codify §2 + §3 (the reactor conventions) and RETIRE the old
`.types.ts`/`.enums.ts`-mandatory rule for DATA (classes-over-interfaces now; enums via reactor `Enum`;
`@template`/view options; `PureReactor` for presentational). Keep the file-size + layer rules.

**Step 3 — Convert ONE real file end-to-end as the reference:** `appearance/nexora/nexora-account-2fa.tsx`
(it's the multi-chunk shape §2 was built for). Split its render chunks into `@template('./2fa-*.view')`
methods, move `React.createRef`→`this.ref()`, `state`+`setState`→`@state`, arrow handlers→`@bound`, its
`Person`-like data → a class. Verify in the browser (admin is baked → `docker compose build admin` per
CLAUDE.md). This locks the pattern.

**Step 4 — Fan out** package by package, biggest cluster first (`ai/` ≈ 35 components), guard counting down
to 0, then flip the guard to ERROR mode. Providers → reactor `Provider`/`Context`; convert per §6 audit.

**Deploy reality:** `packages/react` + `admin` are BAKED (image rebuild ~5-10 min); reactor + nextor are new
workspace packages (symlinked into `node_modules/@fromcode119`, `dist` built). Wire both into the framework
build so plugins/themes/admin can consume them (esbuild plugin list: `TemplateDecoratorPlugin`,
`ViewPairPlugin`, `ViewPlugin`, `UseClientPlugin` — in that order).

---

## 1. The decision (why this exists)

The user dislikes React's functional style (JSX-as-JS, hooks, `export const/function` components) and
the hand-rolled framework core; wants **AS3-style class OOP**. We explored migrating the whole platform
(NestJS+Angular POC, Dart, Haxe, PHP/Laravel) — all rejected. NestJS+Angular fragmented the one-folder
plugin model into two 515 MB apps; Dart/Haxe carry a thin-ecosystem tax.

**Conclusion: do NOT migrate.** TypeScript IS ActionScript 3's ES4 cousin — same `class/extends/
implements`. React is the only real problem, and React can be made fully class-based OOP. So we keep
React + the framework and add an ergonomics layer that confines all "ugly React" to one package.

**JSX vs `html` benchmark (decided to keep JSX):** JSX ~10% faster than the `html` tag (htm), fully
type-checked, better tooling. `html` only wins for plain-DOM markup and is *worse* for
component-heavy code (needs `<${Component}>`). **JSX stays the default.**

---

## 2. `@fromcode119/reactor` — the package (BUILT + VERIFIED)

Location: `framework/Source/packages/reactor/`. **Pure: imports only `react` + `htm`, zero
framework/plugin/auth code.** Publishable, reusable in any React project. `dist` built; symlinked into
`node_modules/@fromcode119`. Verified via `verify/runtime-check.tsx` (26/26).

### Base classes
- **`Reactor`** — the class-based `React.Component` base. Wraps `componentDidMount/DidUpdate/
  WillUnmount` at construction so subclasses never call `super`.
- **`PureReactor`** — `Reactor` + shallow `shouldComponentUpdate` (replaces `React.memo`/`PureComponent`).
- **`Provider`** — base for context providers; `protected readonly channel = SomeContext` + `value()`;
  `render` wires `<Ctx.Provider>`. NOTE: the field is `channel`, NOT `context` (React reserves
  `this.context` for the consumed value and overwrites it). Extend with **no generics**: `extends Provider`.

### Decorators (the only allowed non-class exports — tags/decorators must be functions by JS spec)
- **`@prop`** — `@prop declare url: string` reads `this.props.url` as `this.url`; **removes the `<Props>`
  generic** from the class.
- **`@state`** — `@state open = false`; assign `this.open = true` → re-renders (no `setState`, no
  `<State>` generic). Requires `useDefineForClassFields:false`.
- **`@watch(...keys)`** — method runs when a state/prop key changes, gets `(next, prev)`.
- **`@bound`** — auto-binds a method (stable identity). Pass `this.method` as a callback with no arrow,
  no `.bind`. **Works on ANY class, not just components** (used it on `PeopleColumns`).

### Reactor instance methods (wrap the rest of raw React — no `React.*` in app code)
- `this.ref<T = HTMLElement>()` — replaces `createRef`; no `<T>` needed (`this.ref()`).
- `this.uid()` — replaces `useId`.
- `this.patch({...})` — typed partial `setState`.
- `this.transition(fn)` / `Transition.run(fn)` — replaces `useTransition`/`startTransition`.
- `this.subscribe(register)` — replaces `useSyncExternalStore`; auto-cleans on unmount.
- `this.listen(target, type, handler, options?)` — `addEventListener` + auto-remove on unmount.
- `this.onUnmount(cleanup)` — register a cleanup; **kills `private x?: () => void` fields, `this.x?.()`
  optional calls, and null-checked `componentWillUnmount`.**

### Other
- **`Enum`** — method-bearing type-safe enums (PHP 8.1 / Java style): `static readonly DRAFT = new
  Status('draft','grey')`; `Status.PUBLISHED.color`, `.values()`, `.fromValue()`, `.has()`,
  self-registering, serializes to its value. Replaces plain TS `enum`.
- **`Context`** — `new Context(defaultValue)` (type inferred, no `<T>`); wraps `createContext`.
- **`html`** — htm tagged template (`html\`<b>${x}</b>\``). Available but NOT the default (JSX is).
- **`view`** (advanced/escape-hatch only) — `protected readonly view = SomeViewClass` renders a separate
  View **class** (gets the instance as `model`). NOTE: decided this is NOT the default — separating a
  component's view into a second class is redundant ceremony. Normal components override `render()`.

---

## 3. Conventions (the rules — these OVERRIDE current CLAUDE.md where they conflict)

1. **Zero `export function` / `export const` components — everything is a `class`.** The ONLY exception
   is the `reactor` package's decorators + `html` (tags/decorators must be functions).
2. **Components:** `extends Reactor` (or `PureReactor`/`Provider`). No `<Props, State>` generics —
   `@prop`/`@state` carry them. No hooks. No raw `React.*` (use reactor's wrappers).
3. **Logic in getters; `render()` reads, never computes.** Derived values (`isCheckout`,
   `showCosmicEffects`) are getters. `render()` is pure design referencing them.
4. **One class = one component.** Big markup chunks → real child components (`<CheckoutHeader/>`), not a
   shadow "view file".
5. **Inline callbacks → `@bound` methods, passed by name.** Never `foo(() => {...})`.
6. **Data shapes are CLASSES, not interfaces/types.** Kill `type` aliases and `.interfaces.ts`/
   `.types.ts` files for data. A `Person` is a class with behavior (`get displayName()`, `get isLinked()`)
   — moves logic onto the data, cleans up consumers. COST: hydrate API JSON via `Person.from(row)`.
   Interfaces remain ONLY for genuine behavioral contracts (`interface HasColor { color(): string }`).
   Enums use reactor's `Enum` class.
7. **Styling in CSS/LESS files, never in `.ts`.** Chakra style-props / inline styles → LESS classes
   where the component is purely presentational. Keep component libraries only where they carry behavior.
8. **No defensive `typeof x === 'function'` guards** (already a rule — trust the contract).
9. Data-nullability (`page?.slug`, `String(x || '')`) → SDK `CoercionUtils`, not hand-rolled — that's
   the SDK's job, not reactor's (reactor is framework-free).

---

## 4. The trade-off triangle (why templating keeps fighting us)

For a separate markup file you can have any TWO of: **clean file (no imports/ceremony)** / **keep
components (Box, Navbar)** / **no build magic**. React can't give all three (JSX = functions + imported
components). Vue picks clean+components via build magic (auto-import); React picks components+no-magic via
imports; plain HTML picks clean+no-magic by dropping components.

**DECIDED direction:** accept build magic (option B + auto-import), because the user wants clean files AND
components. See §5.

---

## 5. Build tooling & registry

**BUILT + VERIFIED:**
- **Component registry (option B)** — `Registry` class in reactor (pure React, `src/registry.ts`).
  Register in BULK, not one-by-one: `Registry.addAll(Chakra)` / `Registry.addAll({ Navbar, Footer })`
  (skips non-component exports). `Registry.get(key)` resolves. **Collisions THROW** → pick a distinct key
  (`Registry.add('RouterLink', RouterLink)`), never `import { Link as Link2 }`. `has()`/`keys()` too.
  Works uniformly for Chakra / native / custom components. (31/31 reactor assertions.)
### `@fromcode119/nextor` — the Next/build layer (BUILT + VERIFIED)

Separate package `framework/Source/packages/nextor/`. Holds ALL build/Next-specific machinery so reactor
stays pure React. NOT loose scripts. Symlinked into `node_modules/@fromcode119`. Verified via
`verify/run-build.mjs`. **Fully reusable / standalone**: zero framework/auth/plugin coupling; it never
IMPORTS reactor (reactor is an OPTIONAL peer dep) — it only *emits* `import { Registry } from '<module>'`
into compiled views, and that module name is configurable via `ViewPlugin.esbuild({ registryModule })`
(default `@fromcode119/reactor`). Only real dep is `@babel/parser`.

- **`UseClientPlugin`** (`src/use-client-plugin.ts`) — `.client.*` filename → injects `'use client'` at
  build (idempotent). The literal never appears in source. esbuild plugin (`UseClientPlugin.esbuild()`);
  a Vite/Rollup `transform` hook can reuse `injectInto()`.
- **`ViewPlugin`** (`src/view-plugin.ts`) — the **JSX template compiler**. A `*.view.tsx` file holds ONLY
  bare markup (no class/function/imports); at build it's wrapped into a default-exported template function
  whose Capitalized component tags (`<Box>`, `<Icons.Mail>`) are resolved from the reactor `Registry` (root
  identifier). Native DOM tags pass through. Tag detection is **AST-based (@babel/parser)** — walks JSX
  opening elements, so `<Tag>` in strings/comments and `a < b` are never mistaken for tags (6/6 verified).
  **Suffix configurable**: `ViewPlugin.esbuild({ suffix: 'template' })` → `*.template.tsx`. View files are
  NOT type-checked (esbuild only) — matches low-types stance.
- **`ViewPairPlugin`** (`src/view-pair-plugin.ts`) — **auto-pairing**, so the component needs NO view import
  AND NO render/`view` line. For a `card.tsx` with a sibling `card.view.tsx`, the build finds the single
  exported class (one-class-per-file rule) and sets `Class.prototype.view` to the compiled view. Pair AFTER
  ViewPlugin. Non-paired `.tsx` pass through untouched.

- **`TemplateDecoratorPlugin`** (`src/template-decorator-plugin.ts`) — resolves the `@template('./x.view')`
  decorator: AST-based (@babel/parser, `decorators-legacy`), rewrites the string path into a real import so
  reactor's `template` decorator receives the compiled view fn. Only actual decorator nodes are touched — a
  `@template('…')` inside a string/comment is left alone (verified). Place BEFORE ViewPlugin/ViewPairPlugin.

**Component wiring — FOUR styles, all verified (`nextor/verify/run-build.mjs`), pick per component:**
  1. inline `render()` (default, no build tooling);
  2. `import cardView from './card.view'; protected readonly view = cardView;` (one import, no render);
  3. **`@template('./x.view')`** — works on a CLASS (sets the whole `view`, no render) OR on a METHOD (that
     method returns the chunk, this-bound). The METHOD form is the key one: a component with several UI
     chunks (e.g. `nexora-account-2fa.tsx`: loading/idle/setup/enabled) keeps a plain `render()` that
     composes `this.renderSetup()`/`this.renderEnabled()`, each `@template('./chunk.view')` with its markup in
     its own file. Explicit path, NO view import. Name files anything.
  4. **auto-pair** (`ViewPairPlugin`): `card.tsx` + sibling `card.view.tsx`, ZERO import/render/view/decorator
     line (implicit by filename) — for the whole-component case only.
`render()` can always stay inline (plain JSX/HTML) and compose `@template` methods however you like.
reactor's `view?: (this) => ReactNode`; `render()` calls `this.view.call(this)` when set, else the
subclass's own `render()` wins — so inline and file styles ALWAYS coexist.

Registry note: `isComponent` accepts any function OR non-null object (so icon/namespace objects like
`Icons` used as `<Icons.Mail>` register), skipping only primitives.

**OPEN (nice-to-have):** an *auto-import* variant so even normal `.tsx` (non-`.view`) files could drop
import lines by resolving tags from the Registry. Lower priority now that `.view` templates exist.

---

## 6. OPEN — framework conversion (the actual migration)

- **Guard first:** `check-framework-oop.mjs`, wired into `npm run build`, fails on any non-type `react`
  import / hook call / `<Props>` generic / bare `export function` component OUTSIDE `packages/reactor`.
  Prints remaining-violation count per package so scope is always known.
- **Audit (framework packages):** 42 `export function/const` components (~35 in `ai/`, ~6 in `admin/`, 1
  in `react/`); 560 hook call sites; 222 `type` aliases (many false positives — Drizzle schema, Next route
  flags — triage, don't blanket-kill); 10 plain enums; 154 inline `style={{}}`; 45 createContext/memo/
  forwardRef. EVERY hook has a class replacement (see §2). Providers convert (render `<Ctx.Provider>` in a
  class); forwardRef/useImperativeHandle disappear (classes take refs natively).
- **Order:** guard → convert `ai/` cluster → fan out package by package → burn count to 0.
- **Deploy note:** `packages/react` + `admin` are BAKED → image rebuild to go live. reactor is a new
  workspace package (symlinked; add to workspace + build `dist`).
- **CLAUDE.md:** update to codify §2/§3, retire the `.types.ts`/`.enums.ts` mandate for data.

---

## 7. Worked example — `people-columns.tsx` (BEFORE → target)

`export function buildPeopleColumns(theme, displayName)` → `class PeopleColumns`:
- cell renderers = `@bound` methods passed by name (`accessor: this.person`, no arrow);
- `theme === 'dark' ? …` className → a `get nameClass()`;
- `Person` becomes a **class** (`person.ts`) with `get displayName()` / `get isLinked()` → `displayName(p)`
  becomes `p.displayName`, `userId != null && userId !== ''` becomes `p.isLinked`; the `displayName` ctor
  param disappears;
- `import type { Person } from './people-page.interfaces'` → `import { Person } from './person'`;
- drop `'use client'` here (the page above is the real boundary) — or rename to `.client.tsx` once the
  build convention exists.

---

## 7b. Performance (measured)

SSR benchmark, 100-card grid, 3000 renders (react-dom/server):
- **First pass:** reactor ~22% slower than React function+hooks — per-instance cost of installing `@state`
  accessors and wrapping lifecycle on every instance.
- **Optimized** (shipped): `@state` accessors defined on the class PROTOTYPE once (not per instance),
  per-class metadata cached in a WeakMap, lifecycle methods wrapped ONLY when needed (`@state`→didMount,
  watchers→didUpdate, cleanups→willUnmount lazily via `onUnmount`). Result: **on par with plain React,
  within measurement noise** (~4,100 renders/s both; presentational ~4,200 both). Correctness preserved (32/32).
- **Bundle footprint:** reactor runtime ≈ **2 KB gzipped** (5.3 KB min), htm ≈ 0.66 KB (only if `html` used).
  Negligible vs React+ReactDOM (~46 KB gzipped) and any real app bundle.
- **UPDATE benchmark (jsdom, react-dom/client): where classes WIN.** 3000+ parent re-renders, 100 children
  with UNCHANGED props:
  - no skip: React function (no memo) ~2,800/s ≈ Reactor ~2,840/s (parity).
  - **skip: React.memo ~9,300/s ≈ PureReactor ~9,100/s** (both ~3.3× faster). PureReactor's shallow-compare was
    tightened (single-pass, no hasOwnProperty) → within ~2% of React.memo.
  - **The benefit:** `PureReactor` gives ~React.memo performance **automatically by inheritance** — extend it and
    the component skips re-renders on unchanged props. Function components need explicit `React.memo` on every
    one (routinely forgotten). Make presentational components extend `PureReactor` and the app gets ~3.3× faster
    updates for free.
- **Lighthouse:** would be ~identical — it measures bundle/network/images/hydration/CLS, none of which reactor
  changes (same React underneath, ~2 KB added, render perf equal, updates equal-or-faster). nextor is 100%
  BUILD-time — compiled views are plain React elements, zero runtime/bundle cost.

## 8. Gotchas

- **Nested React copy:** reactor devDep must be `react ^19` to match the framework. A stray `npm install`
  materialized `packages/reactor/node_modules/react@18` → duplicate-React "Objects are not valid as a
  React child" SSR crash. Fixed (aligned devDep + deleted nested copy). Worth a guard.
- `useDefineForClassFields:false` is REQUIRED (field initializers must assign, so `@state`/`@prop`
  accessors aren't clobbered).
- Provider field is `channel`, not `context` (React reserves `this.context`).
- `@template` METHOD typing: annotate `: ReactNode` with a `return null;` placeholder body (the build fills
  it). Do NOT type it `: unknown` and do NOT `(this as any).method()` — that was a fixup mistake. `ReactNode`
  composes in JSX with no cast. (An empty `{}` body returns `void`, which JSX rejects — hence `return null`.)

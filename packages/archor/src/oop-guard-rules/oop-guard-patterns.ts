/**
 * The source patterns the OOP guard matches — React imports, hooks, function/const component exports,
 * module-level bindings, class heads.
 *
 * Split out of OopGuard (669 lines) 2026-09-09. Kept together because they are read as a set: what
 * counts as "a component" is the sum of these, and a rule changed in isolation drifts from the rest.
 */
export class OopGuardPatterns {
  // --- detectors -------------------------------------------------------------
  // Non-type react import: an `import ... from 'react'|'react-dom'` statement NOT beginning with `import type`.

  static readonly REACT_IMPORT = /^\s*import\s+(?!type\b)[^;]*?\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/m;

  // Built-in hooks.
  // A hook CALL — the trailing `(` matters: `ReturnType<typeof Hooks.useState>` in a .interfaces.ts file is a
  // TYPE reference, not a call, and must not be reported as a hook.
  static readonly BUILTIN_HOOK = /\buse(State|Effect|LayoutEffect|Memo|Ref|Callback|Context|Id|Reducer|Transition|DeferredValue|SyncExternalStore|ImperativeHandle|InsertionEffect)\s*\(/;

  // Custom hook invocation: bare `useXxx(` not preceded by `.` (namespace/method calls) or a word char.
  // Applied to .tsx only — in .ts, `static useSink(` (a method DEFINITION) is a false positive; real React
  // hooks live in components (.tsx), and a .ts that touches React still trips OopGuardPatterns.REACT_IMPORT / OopGuardPatterns.BUILTIN_HOOK.
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
  // GENERATED by nextor, never authored. `export default function` is already covered by OopGuardPatterns.FC.
  static readonly EXPORT_DEFAULT_EXPR = /^export\s+default\s+(?!function\b|class\b)\S/m;

  // Module-level `const`/`let` — state and constants belong to a class, not to a module.
  static readonly TOP_LEVEL_BINDING = /^(?:const|let)\s+[A-Za-z_$][\w$]*\s*[:=]/gm;

  // `type X = ...` aliases: a data shape is an interface, a closed set is an Enum.
  static readonly TYPE_ALIAS = /^(?:export\s+)?type\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*=/gm;

  // `export default class` — Next/Vite required default exports are generated by nextor, not authored.
  static readonly EXPORT_DEFAULT_CLASS = /^export\s+default\s+class\b/gm;


  static readonly CLASS_HEAD = /^export\s+(?:abstract\s+)?class\s+(\w+)([^{]*)\{/gm;

  // A class is REAL (not a data record) when its body shows any of: behaviour, a DECORATED member
  // (runtime metadata — entity columns), a field INITIALISER, or an access modifier. Learned the hard
  // way: decorators are illegal on an interface, and an initialiser/modifier cannot survive one either.
  static readonly CLASS_BEHAVIOUR = /\b(constructor\s*\(|static\s|get\s+\w+\s*\(|set\s+\w+\s*\(|async\s|render\s*\(|\w+\s*\([^)]*\)\s*[:{])|^\s*@\w|^\s*(?:private|protected|public)\s|[:?][^;\n]*=\s/m;


  static readonly IMPLEMENTS_CLAUSE = /\bimplements\s+([A-Za-z0-9_,\s<>.]+)/g;
}

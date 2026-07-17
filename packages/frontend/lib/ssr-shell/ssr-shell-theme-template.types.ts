/**
 * Theme-owned SSR shell contract (`theme.json` → `ui.ssrShell`).
 *
 * The framework owns the MECHANISM (match a template for the document, resolve
 * theme-declared paths against framework-owned sources, render, preload the flagged
 * image, overlay/hide lifecycle). The theme owns the VOCABULARY and the DESIGN: which
 * values it wants, what they are called, where they live, and the markup around them.
 * The framework contains no content-field names at all.
 *
 * ── Sources (`from`) ────────────────────────────────────────────────────────────
 * Framework-owned concepts only — never a plugin/theme concept:
 *  - `doc`      — the resolved page document
 *  - `site`     — site settings
 *  - `prefetch` — a `ui.prefetchApis` payload, selected by `key`
 *
 * ── Tokens ──────────────────────────────────────────────────────────────────────
 * `tokens: [{ name, from, key?, path, url?, preload?, pageMatchPath? }]` → `{{name}}`.
 * `path` is one dot-path or an ordered list (first non-empty wins); see
 * `SsrShellPathResolver` for the grammar (`*` wildcard, locale unwrapping).
 * Exactly one token may set `preload: true` — that is the LCP image: the framework
 * emits its `<link rel=preload as=image>` and the template renders it. The framework
 * never names it.
 *
 * ── Lists ───────────────────────────────────────────────────────────────────────
 * `lists: [{ name, from, key?, path, fields }]` → `{{#each name}}…{{/each}}`, with
 * `{{field}}` inside the block. `fields` maps a template name to a path (or to
 * `{ path, url }`). An item whose declared fields do not ALL resolve is dropped.
 * This is why the framework builds no nav markup: the theme's template owns it.
 *
 * ── Framework mechanism tokens ──────────────────────────────────────────────────
 * `themeAssetBase` (also substituted in the shell css, raw, for `url(...)`),
 * `preloadSrcSet` and `preloadSizes` (from the prefetch entry's `lcp` config).
 *
 * ── Templates ───────────────────────────────────────────────────────────────────
 * `templates: [{ match?, template }]` — an ordered rule list evaluated against the
 * document's generic identity (its `slug` and layout name); first match wins, a rule
 * without `match` is a catch-all. The framework knows nothing about what the families
 * MEAN — the theme owns the mapping and the files.
 */
export type SsrShellTemplateMatch = {
  /** Exact page slugs (`''` matches a document without a slug). Case-insensitive. */
  slugIn?: string[];
  /** Slug prefix, e.g. `numerology/`. Case-insensitive. */
  slugPrefix?: string;
  /** Exact layout names (the doc's `themeLayout`/`pageTemplate`). Case-insensitive. */
  layoutIn?: string[];
  /** Layout-name prefix, e.g. `product.`. Case-insensitive. */
  layoutPrefix?: string;
};

export type SsrShellTemplateRule = {
  /** All specified keys must match (AND). Omitted entirely → catch-all rule. */
  match?: SsrShellTemplateMatch;
  /** Template file path inside the theme's served ui directory. */
  template: string;
};

/** The resolved document identity a template rule is evaluated against. */
export type SsrShellTemplateTarget = {
  slug: string;
  layout: string;
};

/** Framework-owned data sources a declared path may be resolved against. */
export type SsrShellSourceKind = 'doc' | 'site' | 'prefetch';

/** `link` = navigation href (kept verbatim); `asset` = fetched media (base-resolved). */
export type SsrShellUrlKind = 'link' | 'asset';

export type SsrShellUrlOptions = {
  /** Public base URL used to absolutize root-relative asset paths (e.g. `/uploads/...`). */
  assetBaseUrl?: string;
  /** Active theme slug: bare relative asset paths (`images/...`) resolve to its ui assets. */
  themeSlug?: string;
};

/** Normalized value locator: ordered candidate paths + optional URL treatment. */
export type SsrShellValueSpec = {
  paths: string[];
  /**
   * Alternatives INSIDE a wildcard-matched element, for a wildcard-terminated path
   * (`path: 'content.*'`, `pick: ['name', 'data.name']`). The element is selected
   * first — the first one where ANY pick resolves — then its first resolving pick is
   * returned, which is what keeps sibling tokens reading from the SAME element.
   */
  pick?: string[];
  url?: SsrShellUrlKind;
};

export type SsrShellTokenConfig = SsrShellValueSpec & {
  /** Template name: `{{name}}` / `{{#if name}}`. */
  name: string;
  from: SsrShellSourceKind;
  /** `ui.prefetchApis` entry key — required when `from` is `prefetch`. */
  key?: string;
  /** Marks the LCP image: the framework preloads this token's resolved value. */
  preload?: boolean;
  /**
   * Optional guard for page-scoped payloads: the token is only resolved when the value
   * at THIS path (e.g. `0.slug`) equals the resolved page's slug (or its last segment,
   * for nested permalinks). Prevents record data from a page-scoped prefetch (e.g. a
   * product referenced by a landing page's blocks) leaking onto pages that are not
   * that record's own page.
   */
  pageMatchPath?: string;
};

export type SsrShellListConfig = {
  /** Template name: `{{#each name}}…{{/each}}`. */
  name: string;
  from: SsrShellSourceKind;
  key?: string;
  /** Ordered candidate paths to the array; the first resolving to a non-empty array wins. */
  paths: string[];
  /** Template field name → locator, resolved against each array element. */
  fields: Record<string, SsrShellValueSpec>;
};

export type SsrShellThemeConfig = {
  /** Normalized, ordered template rules (first match wins). */
  templates: SsrShellTemplateRule[];
  /** Optional companion stylesheet, inlined into the shell as a `<style>` tag. */
  css?: string;
  tokens: SsrShellTokenConfig[];
  lists: SsrShellListConfig[];
  /**
   * Optional theme-declared font files (woff2) to `<link rel=preload as=font>` from the
   * initial document, so the shell paints with the theme's real typography. Entries are
   * paths inside the theme's served ui directory (resolved + versioned by the framework)
   * or absolute http(s) URLs. The `@font-face` rules live in the theme's own css — the
   * framework only warms the fetches.
   */
  fonts?: string[];
};

export type SsrShellThemeAssets = {
  html: string;
  css: string;
  config: SsrShellThemeConfig;
};

import type { SsrShellUrlOptions } from './ssr-shell-theme-template.types';

/**
 * The shell model is entirely generic: the framework resolves what the THEME declared
 * and names nothing itself. There are no content fields here by design — a theme that
 * wants a rich shell declares tokens/lists and a template (see
 * `ssr-shell-theme-template.types.ts`).
 */
export type SsrShellModel = {
  /** Theme-declared token name → resolved, sanitized value. */
  tokens: Record<string, string>;
  /** Theme-declared list name → resolved items (field name → value). */
  lists: Record<string, Array<Record<string, string>>>;
  /**
   * Resolved value of the token flagged `preload: true` — the page's LCP image.
   * Rendering it in the initial HTML plus a matching `<link rel=preload as=image>`
   * makes the real LCP image request-discoverable before the theme JS chain boots.
   */
  preloadImageUrl: string;
};

/** The framework-owned sources a declared `from` selects between. */
export type SsrShellSources = {
  /** The resolved page document. */
  doc: unknown;
  /** Site settings. */
  site: unknown;
  /** `ui.prefetchApis` payloads, keyed by entry key (static + page-scoped merged). */
  prefetch: Record<string, unknown>;
};

export type SsrShellBuildOptions = SsrShellUrlOptions & {
  locale?: string;
};

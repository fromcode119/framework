/** One page render, as sent to a theme render host. Everything the in-process renderer used to read itself. */
export interface IThemeRenderRequest {
  content: unknown;
  locale: string;
  contentClassName: string;
  contentStyle: Record<string, string> | null;
  notFoundPath?: string;
  /** The raw request path and origin — what `window.location` will say in the browser (`RenderLocationUtils`). */
  requestPath: string;
  requestOrigin: string;
  /** The per-request `/system/frontend` payload (menus, settings, plugins, active theme). */
  config: Record<string, unknown>;
  serverTranslations: Record<string, unknown>;
  /** Both prefetch passes merged — the theme's page-agnostic entries and the page-scoped ones. */
  prefetched: Record<string, unknown>;
}

/**
 * Records a plugin's own page needs in its FIRST response (manifest `ui.pagePrefetch`).
 *
 * A storefront component cannot fetch during a server render — it is synchronous — so a list the plugin
 * loads after mount went out as a spinner. An entry names one of the plugin's OWN routes for pages of one
 * `recipe`; the storefront fetches it before rendering and publishes the payload under
 * `<pluginSlug>:<key>` in the page prefetch, on both sides of hydration, as
 * `{ query, data }` — `query` being exactly what was asked, so the component uses the payload only when it
 * would ask the same.
 *
 * Only anonymous-safe routes belong here: the fetch is unauthenticated and the payload lands in shared HTML.
 */
export interface IPluginPagePrefetchEntry {
  /** The page recipe this applies to (the resolved document's `recipe`). */
  recipe: string;
  /** Where the payload lands, after the plugin's slug: `<pluginSlug>:<key>`. */
  key: string;
  /** The plugin route, relative to its API base (`products`). */
  path: string;
  /** Fixed query parameters. */
  query?: Record<string, string>;
  /** Parameters taken from the page address: `{ <address parameter>: <route parameter> }`. */
  requestQuery?: Record<string, string>;
}

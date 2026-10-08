import type { IPluginReadRouteParam } from '@core/plugin/interfaces/plugin-read-route-param.interface';
import type { IPluginReadRouteFilter } from '@core/plugin/interfaces/plugin-read-route-filter.interface';
import type { IPluginReadRouteSort } from '@core/plugin/interfaces/plugin-read-route-sort.interface';

/**
 * A public GET route of the plugin that the framework answers itself, from records the plugin keeps
 * ready in one of its collections — so the request never crosses into the plugin's process.
 *
 * The plugin declares it in its own manifest; the framework names no plugin and knows nothing of what
 * the records are. The read goes through the collection's ordinary public read — its access rule, the
 * published-only rule, staff-only fields, the site's isolation — so nothing a visitor may not read
 * through the collection can reach them this way. A request this route does not match goes to the
 * plugin as before.
 */
export interface IPluginReadRoute {
  /** The route path within the plugin, as the plugin registers it (`/products`). */
  path: string;
  /**
   * The segments of `path` that name a record (`/products/:slug` → `{ "slug": { "field": "slug" } }`). With
   * `params` the route answers ONE record and must say so with `single`.
   */
  params?: Record<string, IPluginReadRouteParam>;
  /**
   * The route answers one record: its document, not a list. A record that is missing, not prepared, past
   * its `freshUntil`, or with no entry for the request's language goes to the plugin, which answers it
   * (or says it is not there).
   */
  single?: boolean;
  /**
   * The document field holds one document per language, keyed by the short language code a request reads in (`bg`, `en` — `context.i18n.currentLocale()`; `''` when it names none), because the document is
   * worded in the language the request reads in. The answer is the request's own language's entry; there is
   * no fallback to another language, which would be an answer the plugin would not have given.
   */
  documentByLocale?: boolean;
  /**
   * With `documentByLocale`: a query parameter whose value further keys the document (`currency=EUR` is the
   * entry `bg:EUR`). `accepts` is the pattern its value must match; a request naming one that does not is
   * not this route's. A request that does not name the parameter is answered with the plain language entry.
   */
  documentVariant?: { param: string; accepts: string };
  /**
   * Whether the answer, for an anonymous visitor, is kept like the answer of a plugin route that declares
   * `anonymousCache`: the same site revision and maximum age, never for a signed-in visitor.
   */
  anonymousCache?: boolean;
  /** Query values that must ALL be present for the framework to answer (`{ "view": "card" }`). */
  when?: Record<string, string>;
  /** Query keys that must ALL be present, with a value, for the framework to answer (a route made for lookups). */
  requires?: string[];
  /** Request headers whose presence sends the request to the plugin (a password the plugin checks, say). */
  unlessHeaders?: string[];
  /** Query keys whose presence — any value, even one that is not text — sends the request to the plugin. */
  unless?: string[];
  /** The plugin collection the records live in (its slug). */
  collection: string;
  /** The field whose value IS each returned item. */
  document: string;
  /**
   * The field holding the moment until which each stored document is exact — for a document that depends
   * on the clock, such as a price while a sale runs: nothing is written when the sale ends, so the stored
   * document would go on showing it. A document past that moment, or with no moment, is treated as not
   * prepared yet, and the plugin answers the request instead.
   */
  freshUntil?: string;
  /** Conditions the route always applies — field equals value — whatever the request asks. */
  where?: Record<string, string | number | boolean>;
  /** Query parameters the route narrows by. Any other parameter is ignored. */
  filters?: Record<string, IPluginReadRouteFilter>;
  /**
   * Sort names the route offers (`price` → `?sort=price`, `-price`, `price-asc`, `price-desc`). A request
   * naming any other sort goes to the plugin. Ties break by id, newest first.
   */
  sorts?: Record<string, IPluginReadRouteSort>;
  /**
   * The order when the request names none of `sorts`: a declared sort name (`-updated`), or several,
   * comma-separated and applied in turn (`-sticky,-publishedAt`).
   */
  defaultSort?: string;
  /**
   * A pattern a `?limit=` must match for the framework to answer — for a plugin that reads a limit its own
   * way (`0`, a fraction, an empty value). Any other value is the plugin's to answer.
   */
  limitAccepts?: string;
  defaultLimit?: number;
  maxLimit?: number;
  /** How long a shared cache may keep a visitor's answer; omitted, nothing is cached. */
  cacheSeconds?: number;
}

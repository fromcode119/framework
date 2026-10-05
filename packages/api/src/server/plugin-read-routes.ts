import type { NextFunction, Request, Response } from 'express';
import { CoercionUtils, Logger, PluginState, PluginTenantAccess, ReadRouteMatch, TenantMode } from '@fromcode119/core';
import type { ICollection, IPluginReadRoute, PluginManager } from '@fromcode119/core';
import { Sql } from '@fromcode119/database';
import type { RESTController } from '@api/controllers/rest/rest-controller';
import { CollectionReadOptions } from '@api/services/collection-read-options';
import { CollectionReadColumns } from '@api/services/collection-read-columns';

/**
 * Answers a plugin's declared read routes (IPluginReadRoute) itself, from the records the plugin keeps
 * ready, so the request never crosses into the plugin's process. Everything else goes on to the
 * plugin's own routes, unchanged.
 *
 * The answer comes from the collection's ordinary read (RESTController.find): its access rule, the
 * published-only rule, staff-only fields and the site's isolation all apply, exactly as on
 * `/collections/<slug>`. A route may read only a collection its own plugin registered, and only for a
 * site that runs that plugin. The framework names no plugin: every route comes from a manifest.
 */
export class PluginReadRoutes {
  private static readonly DEFAULT_LIMIT = 50;
  private static readonly MAX_LIMIT = 200;
  private static readonly logger = new Logger({ namespace: 'plugin-read-routes' });
  private static readonly patterns = new Map<string, RegExp | null>();

  constructor(private readonly manager: PluginManager, private readonly restController: RESTController) {}

  readonly handle = (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') return next();
    const match = this.match(req);
    if (!match) return next();
    // A read route that fails is a bug to see, not a visitor's error: it is logged, and the plugin
    // answers the request as it did before the route existed.
    void this.answer(req, res, next, match.route, match.collection).catch((error: unknown) => {
      PluginReadRoutes.logger.error(`Read route ${req.path} failed; the plugin answers instead: ${String((error as any)?.message || error)}`);
      if (!res.headersSent) next();
    });
  };

  private match(req: Request): { route: IPluginReadRoute; collection: ICollection } | null {
    const path = req.path;
    const end = path.indexOf('/', 1);
    if (end < 0) return null;
    const slug = path.slice(1, end).toLowerCase();
    const plugin = this.manager.getPlugins().find((entry) => String(entry.manifest?.slug || '').toLowerCase() === slug);
    const routes = plugin?.manifest?.readRoutes;
    if (!plugin || plugin.state !== PluginState.ACTIVE || !Array.isArray(routes) || routes.length === 0) return null;
    if (TenantMode.isEnabled() && !PluginTenantAccess.isBundledSlug(slug) && !PluginTenantAccess.isEnabledForCurrentTenant(slug)) return null;

    const rest = path.slice(end).toLowerCase();
    const query = (req.query || {}) as Record<string, unknown>;
    const route = routes.find((candidate) => String(candidate.path || '').toLowerCase() === rest
      && Object.entries(candidate.when || {}).every(([key, value]) => CoercionUtils.toString(query[key]) === String(value))
      && (candidate.unless || []).every((key) => query[key] === undefined || query[key] === null || query[key] === '')
      && (CoercionUtils.toString(query.sort) === '' || PluginReadRoutes.parseSort(query.sort, candidate) !== null)
      && PluginReadRoutes.acceptsValues(candidate, query));
    if (!route) return null;
    const collection = this.ownCollection(slug, route.collection);
    return collection ? { route, collection } : null;
  }

  /** Whether every filter value the request names is one the route declares it can answer. */
  static acceptsValues(route: IPluginReadRoute, query: Record<string, unknown>): boolean {
    return Object.entries(route.filters || {}).every(([param, filter]) => {
      const value = CoercionUtils.toString(query[param]).trim();
      if (!filter.accepts || value === '') return true;
      return PluginReadRoutes.pattern(filter.accepts)?.test(value) ?? false;
    });
  }

  /** A declared pattern, compiled once; one that does not compile accepts nothing. */
  private static pattern(source: string): RegExp | null {
    if (!PluginReadRoutes.patterns.has(source)) {
      let compiled: RegExp | null = null;
      try { compiled = new RegExp(source, 'u'); } catch { PluginReadRoutes.logger.warn(`Read route pattern does not compile: ${source}`); }
      PluginReadRoutes.patterns.set(source, compiled);
    }
    return PluginReadRoutes.patterns.get(source) ?? null;
  }

  /** The collection by the plugin's own name for it — never one another plugin registered. */
  private ownCollection(pluginSlug: string, name: string): ICollection | null {
    const registered = (this.manager as any).registeredCollections as Map<string, { collection: ICollection; pluginSlug: string }> | undefined;
    for (const entry of registered?.values() ?? []) {
      if (String(entry.pluginSlug || '').toLowerCase() !== pluginSlug) continue;
      const collection = entry.collection;
      if (collection.slug === name || collection.shortSlug === name || (collection as any).unprefixedSlug === name) return collection;
    }
    return null;
  }

  private async answer(req: Request, res: Response, next: NextFunction, route: IPluginReadRoute, collection: ICollection): Promise<void> {
    const query = (req.query || {}) as Record<string, unknown>;
    const max = Math.max(1, Number(route.maxLimit) || PluginReadRoutes.MAX_LIMIT);
    const requested = parseInt(CoercionUtils.toString(query.limit), 10);
    const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : Number(route.defaultLimit) || PluginReadRoutes.DEFAULT_LIMIT, max);

    // The request as the collection read sees it: everything of the visitor's (user, site, headers),
    // but only the clamped limit and the language as its query. Own properties, because Express defines
    // `query` as a getter on the request's prototype and an assignment would throw.
    const read = Object.create(req);
    Object.defineProperty(read, 'query', {
      value: { limit: String(limit), ...(query.locale !== undefined ? { locale: query.locale } : {}) },
      writable: true, enumerable: true, configurable: true,
    });
    read[CollectionReadOptions.KEY] = {
      where: (db: any, table: any) => PluginReadRoutes.filterClause(db, table, route, query),
      orderBy: (db: any, table: any) => PluginReadRoutes.order(db, table, route, query.sort, new Set(CollectionReadColumns.onRequest(collection))),
      // The answer is the prepared document (and, where it expires, the moment it does): no other column is
      // read, and nothing counts the matches.
      fields: route.freshUntil ? [route.document, route.freshUntil] : [route.document],
      withoutTotal: true,
    };

    const result: any = await this.restController.find(collection, read);
    const now = Date.now();
    const items = (result?.docs || []).map((doc: Record<string, unknown>) => (
      route.freshUntil && !PluginReadRoutes.freshAt(doc?.[route.freshUntil], now) ? null : doc?.[route.document]
    ));
    // A record the plugin has not prepared yet (a fresh install, a sweep still running) or whose document
    // has outlived the moment it was exact until: the plugin answers instead, so a list never comes back
    // short, missing a record it should hold, or showing what is no longer true.
    if (items.some((item: unknown) => item == null)) return next();
    const cacheSeconds = Number(route.cacheSeconds) || 0;
    res.set('Cache-Control', cacheSeconds > 0 && !(req as any).user ? `public, max-age=${cacheSeconds}` : 'private, no-store');
    res.json(items);
  }

  /** Whether a stored document is still exact at `now`: its moment is a time, and not yet passed. */
  static freshAt(until: unknown, now: number): boolean {
    if (until === null || until === undefined || until === '') return false;
    const at = until instanceof Date ? until.getTime() : new Date(until as string | number).getTime();
    return Number.isFinite(at) && at > now;
  }

  /**
   * The route's fixed conditions and the declared filters the request names, ANDed — OR any record the
   * plugin has not prepared yet. An unprepared record is a candidate for every answer, whatever it would
   * match once prepared (its conditions are not set yet): when one falls inside the page, the plugin
   * answers (see `order`).
   */
  static filterClause(db: any, table: any, route: IPluginReadRoute, query: Record<string, unknown>): unknown {
    const fixed = Object.entries(route.where || {}).map(([field, value]) => db.eq(PluginReadRoutes.column(table, route, field), value));
    const requested = Object.entries(route.filters || {})
      .map(([param, filter]) => [CoercionUtils.toString(query[param]).trim(), filter] as const)
      .filter(([value]) => value !== '')
      .map(([value, filter]) => {
        const column = PluginReadRoutes.column(table, route, filter.field);
        return ReadRouteMatch.resolve(filter.match) === ReadRouteMatch.CONTAINS
          ? Sql.query`${column} @> ${JSON.stringify([value])}::jsonb`
          : db.eq(column, value);
      });
    const chunks = [...fixed, ...requested];
    if (chunks.length === 0) return undefined;
    const unprepared = Sql.query`${PluginReadRoutes.column(table, route, route.document)} IS NULL`;
    return db.or(chunks.length === 1 ? chunks[0] : db.and(...chunks), unprepared);
  }

  /**
   * The order the request names among the route's declared sorts — `price`, `-price`, or the older
   * `price-asc` / `price-desc` — else the route's `defaultSort`; ties by id, newest first, so a page is
   * the same page every time it is asked for.
   *
   * On a field the record holds as it is (not one the plugin derives), an unprepared record already sorts
   * where it belongs: if none falls inside the page, the page is exactly the plugin's. Only a sort on a
   * derived (`readOnRequest`) field puts unprepared records first — that costs a full sort, so a route
   * should sort by real fields.
   */
  static order(db: any, table: any, route: IPluginReadRoute, sort: unknown, derived: ReadonlySet<string> = new Set()): unknown[] {
    const parsed = PluginReadRoutes.parseSort(sort, route) ?? PluginReadRoutes.parseSort(route.defaultSort, route);
    const field = parsed ? route.sorts![parsed.name].field : 'id';
    const column = PluginReadRoutes.column(table, route, field);
    const order = [!parsed || parsed.descending ? db.desc(column) : Sql.query`${column} asc`];
    if (field !== 'id') order.push(db.desc(PluginReadRoutes.column(table, route, 'id')));
    if (derived.has(field)) order.unshift(Sql.query`(${PluginReadRoutes.column(table, route, route.document)} IS NULL) DESC`);
    return order;
  }

  /**
   * A field the route names, on the collection's table. One the table does not have is a manifest that
   * does not match its collection: the read fails, it is logged, and the plugin answers — an empty
   * answer would look like a store with nothing in it.
   */
  private static column(table: any, route: IPluginReadRoute, field: string): unknown {
    const column = table[field];
    if (!column) throw new Error(`Read route ${route.path} names "${field}", which collection ${route.collection} does not have.`);
    return column;
  }

  static parseSort(value: unknown, route: IPluginReadRoute): { name: string; descending: boolean } | null {
    const raw = CoercionUtils.toString(value).trim();
    if (!raw) return null;
    const legacy = /^([A-Za-z0-9_]+)-(asc|desc)$/.exec(raw);
    const name = legacy ? legacy[1] : raw.replace(/^-/, '');
    if (!route.sorts?.[name]) return null;
    return { name, descending: legacy ? legacy[2] === 'desc' : raw.startsWith('-') };
  }
}

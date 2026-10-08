import { CoercionUtils } from '@fromcode119/core';
import type { IPluginReadRoute } from '@fromcode119/core';
import { Sql } from '@fromcode119/database';

/**
 * The order of a read route's answer: the sort the request names among the route's declared sorts —
 * `price`, `-price`, or the older `price-asc` / `price-desc` — else the route's `defaultSort`, which may
 * name several (`-sticky,-publishedAt`, the way a plugin orders by more than one field); ties by id,
 * newest first, so a page is the same page every time it is asked for.
 *
 * On a field the record holds as it is (not one the plugin derives), an unprepared record already sorts
 * where it belongs: if none falls inside the page, the page is exactly the plugin's. Only a sort on a
 * derived (`readOnRequest`) field puts unprepared records first — that costs a full sort, so a route
 * should sort by real fields.
 */
export class PluginReadRouteOrder {
  static order(db: any, _table: any, route: IPluginReadRoute, sort: unknown, derived: ReadonlySet<string>, column: (field: string) => unknown): unknown[] {
    const requested = PluginReadRouteOrder.parseSort(sort, route);
    const sorts = requested ? [requested] : PluginReadRouteOrder.defaults(route);
    const order: unknown[] = [];
    const fields: string[] = [];
    for (const entry of sorts) {
      const field = route.sorts![entry.name].field;
      const target = column(field);
      fields.push(field);
      order.push(entry.descending ? db.desc(target) : Sql.query`${target} asc`);
    }
    if (!fields.includes('id')) order.push(db.desc(column('id')));
    if (fields.some((field) => derived.has(field))) {
      const document = column(route.document);
      order.unshift(route.freshUntil
        ? Sql.query`(${document} IS NULL OR ${column(route.freshUntil)} IS NULL OR ${column(route.freshUntil)} <= now()) DESC`
        : Sql.query`(${document} IS NULL) DESC`);
    }
    return order;
  }

  /** One declared sort name, read the way a request names it; null for any other. */
  static parseSort(value: unknown, route: IPluginReadRoute): { name: string; descending: boolean } | null {
    const raw = CoercionUtils.toString(value).trim();
    if (!raw) return null;
    const legacy = /^([A-Za-z0-9_]+)-(asc|desc)$/.exec(raw);
    const name = legacy ? legacy[1] : raw.replace(/^-/, '');
    if (!route.sorts?.[name]) return null;
    return { name, descending: legacy ? legacy[2] === 'desc' : raw.startsWith('-') };
  }

  /** The route's default order: each comma-separated declared sort, in turn; none, the newest id first. */
  private static defaults(route: IPluginReadRoute): Array<{ name: string; descending: boolean }> {
    return CoercionUtils.toString(route.defaultSort).split(',')
      .map((part) => PluginReadRouteOrder.parseSort(part, route))
      .filter((entry): entry is { name: string; descending: boolean } => entry !== null);
  }
}

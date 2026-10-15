import type { IPluginReadRoute } from '@fromcode119/core';
import { Sql } from '@fromcode119/database';

/**
 * Whether a record's stored document can answer a read route as it is, in code and in SQL. One place, so
 * the list, the single record and the order agree: a document missing, past its moment, or kept by a
 * release other than the one the route names (`preparedBy`) sends the request to the plugin.
 */
export class PluginReadRoutePrepared {
  /** The columns an answer reads: the document, its moment, and the fields that say which release kept it. */
  static fieldsRead(route: IPluginReadRoute): string[] {
    return [route.document, ...(route.freshUntil ? [route.freshUntil] : []), ...Object.keys(route.preparedBy || {})];
  }

  /** Whether a stored record can be answered as is: still exact, and kept by the release the route names. */
  static usable(route: IPluginReadRoute, doc: Record<string, unknown>, now: number): boolean {
    if (route.freshUntil && !PluginReadRoutePrepared.freshAt(doc?.[route.freshUntil], now)) return false;
    return Object.entries(route.preparedBy || {}).every(([field, value]) => doc?.[field] === value);
  }

  /**
   * SQL true for a record whose stored document cannot be answered: none yet, past its moment, or kept by
   * another release. Such a record is a candidate for every answer, so the plugin answers when one is on
   * the page.
   */
  static unpreparedSql(route: IPluginReadRoute, column: (field: string) => unknown): unknown {
    const document = column(route.document);
    const parts: unknown[] = [Sql.query`${document} IS NULL`];
    if (route.freshUntil) parts.push(Sql.query`${column(route.freshUntil)} IS NULL OR ${column(route.freshUntil)} <= now()`);
    for (const [field, value] of Object.entries(route.preparedBy || {})) parts.push(Sql.query`${column(field)} IS DISTINCT FROM ${value}`);
    return parts.reduce((all, part) => Sql.query`${all} OR ${part}`);
  }

  /** Whether a stored document is still exact at `now`: its moment is a time, and not yet passed. */
  static freshAt(until: unknown, now: number): boolean {
    if (until === null || until === undefined || until === '') return false;
    const at = until instanceof Date ? until.getTime() : new Date(until as string | number).getTime();
    return Number.isFinite(at) && at > now;
  }
}

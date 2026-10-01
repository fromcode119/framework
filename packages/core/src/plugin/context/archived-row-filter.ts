import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { CollectionArchive } from '@core/collections/collection-archive';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * Leaves ARCHIVED rows out of what a plugin lists and counts through `context.db`.
 *
 * An archived record has to disappear from everything that shows records — the storefront's order
 * history, a report's totals, a dashboard count — and every one of those reads goes through this one
 * view. Filtering here, once, is what makes `archive: {}` on a collection enough; the alternative is
 * a `archivedAt: null` in every plugin query, and the one that forgets it leaks.
 *
 * Only the LISTING methods are filtered — `find`, `count`, `groupCount`, `aggregate`. A `findOne` is a point
 * lookup, and those are overwhelmingly integrity questions ("is this invoice number taken?", "load
 * order 42"): hiding an archived row from them is how a sequence reissues a number an archived record
 * already holds. A caller serving the public from `findOne` checks {@link CollectionArchive.isArchived}.
 *
 * A where that already names `archivedAt` is left exactly as written — the caller has decided — and
 * `context.db.withArchived` reads everything, for code that must see archived rows (numbering,
 * restoring, the cascade).
 */
export class ArchivedRowFilter {
  private static readonly FILTERED_METHODS = new Set(['find', 'count', 'groupCount', 'aggregate']);

  static apply(prop: string, args: any[], manager: IPluginManagerInterface): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!ArchivedRowFilter.FILTERED_METHODS.has(prop)) return args;
    if (!CollectionArchive.isArchivable(ArchivedRowFilter.collectionFor(args[0], manager))) return args;

    const options = args[1] ?? {};
    const where = options.where;
    // A built SQL expression cannot be merged into; it is the caller's own SQL and stays as written.
    if (where !== undefined && !ArchivedRowFilter.isPlainObject(where)) return args;
    if (CollectionArchive.mentionsArchive(where)) return args;

    const next = [...args];
    next[1] = { ...options, where: { ...(where ?? {}), ...CollectionArchive.liveWhere() } };
    return next;
  }

  /**
   * The collection behind a table argument. Plugins address their tables semantically
   * (`@<plugin>/orders`) or physically (`fcp_<plugin>_orders`); the registry is keyed on the physical
   * name. Not cached, for the reason {@link LocalizedReadResolver} gives: extensions merge into the
   * registered collection after the fact.
   */
  private static collectionFor(table: unknown, manager: IPluginManagerInterface): ICollection | null {
    const reference = PhysicalTableNameUtils.parse(String(table ?? '').trim());
    if (!reference) return null;
    const entry = manager.getCollection(
      PhysicalTableNameUtils.create(reference.pluginSlug, reference.tableName),
    ) as { collection?: ICollection } | null | undefined;
    return entry?.collection ?? null;
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
}

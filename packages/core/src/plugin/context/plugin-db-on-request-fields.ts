import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * The `readOnRequest` fields (IField) a plugin's own `find` / `findOne` leaves out: every field so
 * declared, unless the `find` names its `columns`. The JSON path does not select them; any other path
 * drops them from the rows it hands over.
 */
export class PluginDbOnRequestFields {
  private static readonly byCollection = new WeakMap<object, { count: number; names: string[] }>();

  static omittedFor(method: string, args: any[], manager: IPluginManagerInterface): string[] {
    if (method !== 'find' && method !== 'findOne') return [];
    const columns = method === 'find' ? args[1]?.columns : undefined;
    if (columns && Object.keys(columns).length > 0) return [];
    const reference = PhysicalTableNameUtils.parse(String(args[0] ?? '').trim());
    if (!reference) return [];
    const entry = manager.getCollection(PhysicalTableNameUtils.create(reference.pluginSlug, reference.tableName)) as { collection?: ICollection } | null | undefined;
    const collection = entry?.collection;
    if (!collection || !Array.isArray(collection.fields)) return [];
    // Keyed by the `fields` array and its length: a plugin updated in place gets a new field list.
    let known = PluginDbOnRequestFields.byCollection.get(collection.fields);
    if (!known || known.count !== collection.fields.length) {
      known = { count: collection.fields.length, names: collection.fields.filter((field) => field?.readOnRequest).map((field) => String(field.name)) };
      PluginDbOnRequestFields.byCollection.set(collection.fields, known);
    }
    return known.names;
  }

  /**
   * Whether an `update(table, where, data)` writes ONLY `readOnRequest` fields — values the plugin derives
   * from the record and keeps ready, never content of their own. Such a write changes nothing a page is made
   * of (what they derive from changed earlier, and moved the site's revision then), so it must not move the
   * revision again: it would throw away every kept answer of the site to store one more.
   */
  static writesOnlyDerived(method: string, args: any[], manager: IPluginManagerInterface): boolean {
    if (method !== 'update') return false;
    const written = Object.keys(args[2] ?? {});
    if (written.length === 0) return false;
    const derived = new Set(PluginDbOnRequestFields.omittedFor('findOne', [args[0]], manager));
    return written.every((name) => derived.has(name));
  }

  static strip(result: unknown, omitted: readonly string[]): unknown {
    if (omitted.length === 0 || result == null) return result;
    const drop = (row: unknown) => {
      if (row && Object(row) === row) for (const name of omitted) delete (row as Record<string, unknown>)[name];
      return row;
    };
    return Array.isArray(result) ? result.map(drop) : drop(result);
  }
}

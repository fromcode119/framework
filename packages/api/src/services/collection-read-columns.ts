import { SqlTable } from '@fromcode119/database';
import type { ICollection } from '@fromcode119/core';
import { CollectionReadRedaction } from '@api/services/collection-read-redaction';

/**
 * Which columns a generic read selects: those a framework caller asked for (ICollectionReadOptions
 * `fields`, with `id` and the fields `withheldWhen` decides on), or — for a reader who does not read the
 * whole collection — every column but the `readOnRequest` ones. `undefined` reads them all.
 */
export class CollectionReadColumns {
  private static readonly onRequestByCollection = new WeakMap<object, { count: number; names: string[] }>();

  /** Keyed by the `fields` array and its length, like CollectionReadRedaction: a re-registered field list is read afresh. */
  static onRequest(collection: ICollection): string[] {
    let known = CollectionReadColumns.onRequestByCollection.get(collection.fields);
    if (!known || known.count !== collection.fields.length) {
      known = { count: collection.fields.length, names: collection.fields.filter((field) => field.readOnRequest).map((field) => field.name) };
      CollectionReadColumns.onRequestByCollection.set(collection.fields, known);
    }
    return known.names;
  }

  static forList(collection: ICollection, table: object, requested: string[] | undefined, partialReader: boolean): Record<string, boolean> | undefined {
    const columns = Object.keys(SqlTable.columnsOf(table) || {});
    if (requested) {
      const wanted = new Set(['id', ...requested, ...CollectionReadRedaction.decidingFields(collection)]);
      return Object.fromEntries(columns.filter((name) => wanted.has(name)).map((name) => [name, true]));
    }
    const omitted = CollectionReadColumns.onRequest(collection);
    if (!partialReader || omitted.length === 0) return undefined;
    return Object.fromEntries(columns.filter((name) => !omitted.includes(name)).map((name) => [name, true]));
  }

  /** A single record as a reader who does not read the whole collection gets it: without `readOnRequest` fields. */
  static withoutOnRequest<T>(collection: ICollection, record: T): T {
    const omitted = CollectionReadColumns.onRequest(collection);
    if (omitted.length === 0 || !record || Object(record) !== record) return record;
    const copy = { ...(record as Record<string, unknown>) };
    for (const name of omitted) delete copy[name];
    return copy as T;
  }
}

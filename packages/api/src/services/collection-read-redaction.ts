import type { ICollection } from '@fromcode119/core';
import type { IReadRedactionShape } from '@api/services/interfaces/read-redaction-shape.interface';

/**
 * What the framework's generic reads hold back from a PARTIAL reader — anyone who does not read the
 * whole collection (an administrator, or a role granted reading it, does).
 *
 * A collection declares it on its own fields and the framework never knows why: `staffOnly` fields
 * are never returned and never usable in a filter, a sort or a search; `withheldWhen` fields come
 * back `null` while a named sibling holds a value, and the record lists them in `withheldFields`.
 * Before this, a collection opened to the public served every column of every row — the stored
 * access password of a protected post, the cost price of a product, the address of a paid file.
 */
export class CollectionReadRedaction {
  /**
   * Marks a read made for page resolution. Its conditional hold-back belongs to the plugins' content
   * gates, which run on the resolved document and know the visitor; a Symbol, so no request can set it.
   */
  static readonly FOR_RESOLUTION = Symbol('collection-read:for-resolution');

  /** The record key listing what a read held back from it. */
  static readonly WITHHELD_KEY = 'withheldFields';

  private static readonly shapes = new WeakMap<object, IReadRedactionShape>();

  /**
   * Worked out once per field list, keyed like the outgoing shape is: by the `fields` array and its
   * length, so a collection registered again, or a field pushed onto it, is read afresh.
   */
  static shapeOf(collection: ICollection): IReadRedactionShape {
    const fields = collection.fields as object;
    let shape = CollectionReadRedaction.shapes.get(fields);
    if (!shape || shape.count !== collection.fields.length) {
      shape = {
        count: collection.fields.length,
        staffOnly: collection.fields.filter((field) => field.staffOnly === true).map((field) => field.name),
        withheld: collection.fields
          .filter((field) => Array.isArray(field.withheldWhen) && field.withheldWhen.length > 0)
          .map((field) => ({ field: field.name, when: (field.withheldWhen as string[]).map(String) })),
      };
      CollectionReadRedaction.shapes.set(fields, shape);
    }
    return shape;
  }

  static declaresAny(collection: ICollection): boolean {
    const shape = CollectionReadRedaction.shapeOf(collection);
    return shape.staffOnly.length > 0 || shape.withheld.length > 0;
  }

  /**
   * The records as a partial reader may see them. `holdBack: false` strips only the staff-only fields
   * and leaves the conditional ones to the caller — page resolution, whose plugin gates know the
   * visitor and decide.
   */
  static redact<T>(collection: ICollection, data: T, holdBack = true): T {
    if (!data || !CollectionReadRedaction.declaresAny(collection)) return data;
    const shape = CollectionReadRedaction.shapeOf(collection);
    if (Array.isArray(data)) {
      return data.map((row) => CollectionReadRedaction.redactRecord(shape, row, holdBack)) as unknown as T;
    }
    return CollectionReadRedaction.redactRecord(shape, data, holdBack);
  }

  /**
   * A filter or a sort on a field a partial reader may not see answers a question about its value —
   * `?postPassword=a`, then `ab` — so it is refused outright, not silently dropped.
   */
  static assertQueryable(collection: ICollection, filters: Record<string, unknown>, sort?: unknown): void {
    if (!CollectionReadRedaction.declaresAny(collection)) return;
    const hidden = CollectionReadRedaction.unqueryable(collection);
    const sortField = String(sort ?? '').replace(/^-/, '');
    const refused = [...Object.keys(filters), sortField].filter((name) => name && hidden.has(name));
    if (refused.length === 0) return;
    const error = new Error(`Cannot filter or sort by: ${[...new Set(refused)].join(', ')}.`) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  /** The fields a partial reader may not filter, sort or search by. */
  static unqueryable(collection: ICollection): Set<string> {
    const shape = CollectionReadRedaction.shapeOf(collection);
    return new Set([...shape.staffOnly, ...shape.withheld.map((entry) => entry.field)]);
  }

  /** Whether a stored value counts as "set" for `withheldWhen` — mirrored in SQL by the search clause. */
  static holdsValue(value: unknown): boolean {
    if (value === null || value === undefined || value === false || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (Object(value) === value && !(value instanceof Date)) return Object.keys(value as object).length > 0;
    return true;
  }

  private static redactRecord<T>(shape: IReadRedactionShape, row: T, holdBack: boolean): T {
    if (!row || Object(row) !== row) return row;
    const source = row as Record<string, unknown>;
    const record: Record<string, unknown> = { ...source };
    if (holdBack) {
      const withheld = shape.withheld
        .filter((entry) => entry.when.some((name) => CollectionReadRedaction.holdsValue(source[name])))
        .map((entry) => entry.field);
      for (const name of withheld) record[name] = null;
      if (withheld.length > 0) record[CollectionReadRedaction.WITHHELD_KEY] = withheld;
    }
    for (const name of shape.staffOnly) delete record[name];
    return record as T;
  }
}

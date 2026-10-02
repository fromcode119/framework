/**
 * One level of a walk over plain data that copies only what the walk changed.
 *
 * A plugin process revives what the host sends back — methods of host objects, callbacks — and almost
 * every answer is rows of plain data with nothing to revive. Copying each row and each array it holds,
 * to find that, was most of the cost of receiving a query result. Here an array or object is copied
 * the first time an entry comes back different, and handed back as it was when none does.
 */
export class CopyOnChange {
  /** `value` with each object entry passed through `revive`; the same array when no entry changed. */
  static array(value: unknown[], revive: (entry: unknown) => unknown): unknown[] {
    let copy: unknown[] | null = null;
    for (let index = 0; index < value.length; index += 1) {
      const entry = value[index];
      if (entry === null || typeof entry !== 'object') continue;
      const next = revive(entry);
      if (next === entry) continue;
      copy ??= [...value];
      copy[index] = next;
    }
    return copy ?? value;
  }

  /** `value` with each object-valued own key passed through `revive`; the same object when none changed. */
  static object(value: Record<string, unknown>, revive: (entry: unknown) => unknown): Record<string, unknown> {
    let copy: Record<string, unknown> | null = null;
    for (const key of Object.keys(value)) {
      const entry = value[key];
      if (entry === null || typeof entry !== 'object') continue;
      const next = revive(entry);
      if (next === entry) continue;
      copy ??= { ...value };
      copy[key] = next;
    }
    return copy ?? value;
  }
}

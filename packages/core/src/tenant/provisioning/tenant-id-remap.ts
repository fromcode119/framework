/**
 * old id → new id, per table, for one import.
 *
 * A table is in "preserve" mode when every id the archive carries is above what the destination's
 * sequence has handed out — then rows keep their ids and nothing needs re-pointing. Otherwise the
 * table is in "remap" mode: each row gets a fresh id from the sequence, and every column that
 * pointed at the old id (see `TenantColumnReference`) is rewritten through `resolve`.
 *
 * Why sequences and not "SELECT id FROM table": under FORCE row-level security the owner connection
 * sees only the tenant it is scoped to, so other tenants' ids cannot be enumerated — by design. The
 * sequence's `last_value` is the one number that bounds them all.
 */
export class TenantIdRemap {
  private readonly tables = new Map<string, Map<string, string>>();
  private readonly remapped = new Set<string>();

  markRemapped(table: string): void {
    this.remapped.add(table);
  }

  isRemapped(table: string): boolean {
    return this.remapped.has(table);
  }

  /** Whether `oldId` of `table` was seen (mapped) at all — false for a row the archive never carried. */
  has(table: string, oldId: unknown): boolean {
    return this.tables.get(table)?.has(String(oldId)) ?? false;
  }

  set(table: string, oldId: unknown, newId: unknown): void {
    const map = this.tables.get(table) ?? new Map<string, string>();
    map.set(String(oldId), String(newId));
    this.tables.set(table, map);
  }

  /** The new id for `oldId` in `table`, or the value unchanged when that table was not remapped or the id is unknown. */
  resolve(table: string, value: unknown): unknown {
    if (value === null || value === undefined || value === '') return value;
    const map = this.tables.get(table);
    if (!map) return value;
    const mapped = map.get(String(value));
    if (mapped === undefined) return value;
    return typeof value === 'number' ? Number(mapped) : mapped;
  }

  count(table: string): number {
    return this.tables.get(table)?.size ?? 0;
  }

  get remappedTables(): string[] {
    return [...this.remapped].sort();
  }

  /**
   * Every `oldId -> newId` this run made for one table, so the map can be written down.
   *
   * A copy, not the live map: the caller persists these while the import is still finishing, and a
   * consumer iterating the internal Map while `set` is called would be reading a moving target.
   */
  entriesFor(table: string): Array<[string, string]> {
    return [...(this.tables.get(table) ?? new Map<string, string>()).entries()];
  }
}

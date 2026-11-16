import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import type { IStructuredTable } from '@/components/collection/fields/interfaces/structured-table.interface';

/**
 * Splitting a column of objects into a column per key, once an array has been arranged as a table.
 *
 * Its own file because it is its own question: {@link StructuredReadOnlyFieldService} turns a JSON
 * value into a shape, and this decides how one column of that shape is best read.
 */
export class StructuredTableSplitService {
  /** Above this many keys an object column is read as one value, not split into a column per key. */
  private static readonly KEY_LIMIT = 4;

  /**
   * A column whose every value is an object of the SAME few keys becomes one column per key.
   *
   * A product's variants carry `options: { Размер: "S", Цвят: "Бяло" }`, and one column holding
   * `Размер: S · Цвят: Бяло` is read value by value; two columns headed Размер and Цвят are read down,
   * which is the whole point of a table. The key becomes the heading, so the value stands alone in the
   * cell — as a chip, since it is one value of a named axis.
   *
   * It is left alone when a key would collide with a column already there, when the object holds more
   * keys than a row can carry, or when a value is anything but a flat object: a split that loses a
   * value is worse than a column that is read twice.
   */
  static split(
    items: IStructuredNode[],
    columns: string[],
    rows: Record<string, IStructuredNode>[],
  ): IStructuredTable {
    const origins: Record<string, string> = {};
    const outColumns: string[] = [];
    const split = new Map<string, string[]>();

    for (const column of columns) {
      const keys = StructuredTableSplitService.splittableKeys(items, column, columns);
      if (!keys) { outColumns.push(column); continue; }
      split.set(column, keys);
      for (const key of keys) { outColumns.push(key); origins[key] = column; }
    }
    if (!split.size) return { columns, rows };

    const outRows = items.map((item, index) => {
      const row: Record<string, IStructuredNode> = {};
      for (const column of columns) {
        const keys = split.get(column);
        if (!keys) { row[column] = rows[index][column]; continue; }
        const source = item.entries?.find((entry) => entry.key === column)?.node;
        for (const key of keys) {
          const value = source?.entries?.find((entry) => entry.key === key)?.node;
          const text = value?.kind === StructuredNodeKind.SCALAR ? String(value.scalarValue ?? '').trim() : '';
          row[key] = text
            ? { kind: StructuredNodeKind.SCALAR, scalarValue: text, entries: [{ key, node: value as IStructuredNode }] }
            : { kind: StructuredNodeKind.EMPTY };
        }
      }
      return row;
    });

    return { columns: outColumns, rows: outRows, columnOrigins: origins };
  }

  /** The keys a column splits into, or nothing when it must stay whole. */
  private static splittableKeys(items: IStructuredNode[], column: string, columns: readonly string[]): string[] | null {
    const keys: string[] = [];
    let objects = 0;
    for (const item of items) {
      const node = item.entries?.find((entry) => entry.key === column)?.node;
      if (!node || node.kind === StructuredNodeKind.EMPTY) continue;
      if (node.kind !== StructuredNodeKind.OBJECT) return null;
      objects += 1;
      for (const entry of node.entries ?? []) {
        if (entry.node.kind !== StructuredNodeKind.SCALAR && entry.node.kind !== StructuredNodeKind.EMPTY) return null;
        if (!keys.includes(entry.key)) keys.push(entry.key);
      }
    }
    if (!objects || !keys.length || keys.length > StructuredTableSplitService.KEY_LIMIT) return null;
    if (keys.some((key) => columns.includes(key))) return null;
    return keys;
  }
}

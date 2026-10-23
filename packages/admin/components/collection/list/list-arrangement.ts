import { CollectionListUtils } from '@/components/collection/list/utils';
import { ListGroup } from '@/components/collection/list/list-group';
import { ListRecordChange } from '@/components/collection/list/list-record-change';
import { DataTableSection } from '@/components/ui/data-table-section';

/**
 * How a list with `admin.list.groupBy` / `admin.list.order` lays its records out, and what a drag
 * changes. Pure: no requests, no React — the page applies the changes it returns.
 *
 * Records are shown in the order of their groups (the order the group field declares: a select's
 * options, or the related collection's own order), records with no group last. Inside a group the
 * order is the list's sort; when that sort is the order field, the records stay in it with the id as
 * the tie-break, so two records with the same number never swap places between loads.
 */
export class ListArrangement {
  /** Marks a section heading's id, so a drop on a heading is told apart from a drop on a record. */
  static readonly HEADING_PREFIX = 'group:';

  constructor(
    readonly groupField: string,
    readonly orderField: string,
    readonly groups: readonly ListGroup[],
    /** The heading of records with no group. */
    readonly noGroupLabel: string,
  ) {}

  groupOf(row: any): string {
    return this.groupField ? CollectionListUtils.resolveRelationScalar(row?.[this.groupField]) : '';
  }

  /** The heading of group `key`; `''` is the records with no group. */
  labelOf(key: string): string {
    if (!key) return this.noGroupLabel;
    return this.groups.find((group) => group.key === key)?.label || `#${key}`;
  }

  /** `rows` in the order the list shows them; `byOrder` when the list is sorted by the order field. */
  arrange(rows: readonly any[], byOrder: boolean): any[] {
    const rank = new Map(this.groups.map((group, index) => [group.key, index]));
    const rankOf = (row: any): number => {
      const key = this.groupOf(row);
      if (!key) return Number.MAX_SAFE_INTEGER;
      return rank.get(key) ?? this.groups.length;
    };
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => (this.groupField ? rankOf(a.row) - rankOf(b.row) : 0)
        || (byOrder ? this.compareOrder(a.row, b.row) : 0)
        || a.index - b.index)
      .map(({ row }) => row);
  }

  /**
   * `rows` (as arranged) split into one section per group: the declared groups in their order, then any
   * group the rows name that is not declared, then the records with no group. With `includeEmpty` every
   * declared group and "no group" gets a section even with no records, so a record can be dragged into it.
   */
  sections(rows: readonly any[], includeEmpty: boolean): DataTableSection<any>[] {
    const byKey = new Map<string, any[]>();
    for (const row of rows) {
      const key = this.groupOf(row);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(row);
    }
    const declared = this.groups.map((group) => group.key);
    const undeclared = [...byKey.keys()].filter((key) => key && !declared.includes(key));
    return [...declared, ...undeclared, '']
      .filter((key) => includeEmpty || byKey.has(key))
      .map((key) => new DataTableSection(
        ListArrangement.HEADING_PREFIX + key,
        this.labelOf(key),
        byKey.get(key) || [],
      ));
  }

  /**
   * The changes that move `dragId` to just before (or, with `after`, just after) `overId`. `rows` is the
   * list as shown — arranged and sorted by the order field. Moving into another group takes that group.
   *
   * The target group keeps the numbers it already has, so a move touches as few records as it can: the
   * group's existing values are handed out again in the new order, made strictly increasing (a duplicate
   * or a blank becomes one more than the value before it). Only records whose values change are returned.
   */
  move(rows: readonly any[], dragId: string, overId: string, after: boolean): ListRecordChange[] {
    if (!this.orderField || dragId === overId) return [];
    const dragged = rows.find((row) => String(row.id) === dragId);
    const heading = ListArrangement.headingKey(overId);
    const over = heading === null ? rows.find((row) => String(row.id) === overId) : undefined;
    if (!dragged || (heading === null && !over)) return [];

    // Dropped on a group's heading: the record goes to the start of that group.
    const targetGroup = heading ?? this.groupOf(over);
    const members = rows.filter((row) => this.groupOf(row) === targetGroup && String(row.id) !== dragId);
    const at = over ? members.indexOf(over) + (after ? 1 : 0) : 0;
    const ordered = [...members.slice(0, at), dragged, ...members.slice(at)];

    const values = this.renumber(ordered.map((row) => this.orderOf(row)));
    const changes: ListRecordChange[] = [];
    ordered.forEach((row, index) => {
      const data: Record<string, unknown> = {};
      if (this.orderOf(row) !== values[index]) data[this.orderField] = values[index];
      if (row === dragged && this.groupField && this.groupOf(row) !== targetGroup) data[this.groupField] = targetGroup || null;
      if (Object.keys(data).length) changes.push(new ListRecordChange(String(row.id), data));
    });
    return changes;
  }

  /**
   * Where a keyboard move of `id` one step `up` (or down) lands, in the sections the list shows. Within
   * its group the record swaps with its neighbour. At a group's edge it crosses into the next section and
   * stays at that edge (the end of the section above, the start of the one below); an empty section is
   * entered through its heading.
   */
  step(sections: readonly DataTableSection<any>[], id: string, up: boolean): { overId: string; after: boolean } | null {
    const at = sections.findIndex((section) => section.rows.some((row) => String(row.id) === id));
    if (at < 0) return null;
    const rows = sections[at].rows;
    const index = rows.findIndex((row) => String(row.id) === id);
    const neighbour = rows[index + (up ? -1 : 1)];
    if (neighbour) return { overId: String(neighbour.id), after: !up };

    const next = sections[at + (up ? -1 : 1)];
    if (!next) return null;
    if (!next.rows.length) return { overId: next.id, after: false };
    const edge = up ? next.rows[next.rows.length - 1] : next.rows[0];
    return { overId: String(edge.id), after: up };
  }

  /** The group key a heading id names, or `null` when the id is a record's. */
  static headingKey(id: string): string | null {
    return id.startsWith(ListArrangement.HEADING_PREFIX) ? id.slice(ListArrangement.HEADING_PREFIX.length) : null;
  }

  private orderOf(row: any): number | null {
    const value = row?.[this.orderField];
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private compareOrder(a: any, b: any): number {
    const left = this.orderOf(a);
    const right = this.orderOf(b);
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  }

  private renumber(current: readonly (number | null)[]): number[] {
    const pool = current.filter((value): value is number => value !== null).sort((a, b) => a - b);
    const values: number[] = [];
    current.forEach((_, index) => {
      const candidate = pool[index] ?? (values[index - 1] ?? 0) + 1;
      values.push(index > 0 ? Math.max(candidate, values[index - 1] + 1) : candidate);
    });
    return values;
  }
}

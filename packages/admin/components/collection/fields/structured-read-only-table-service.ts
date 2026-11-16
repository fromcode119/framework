import type { IField } from '@fromcode119/core/client';
import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * Reading a TABLE of a structured value: when it stops being read and starts being searched, which of
 * its columns are worth offering as a filter, and what a row says as plain text.
 *
 * Split from {@link StructuredReadOnlyFieldService}, which classifies a value into nodes. Those are two
 * jobs: one turns JSON into a shape, this one answers questions about the shape once it is a table.
 */
export class StructuredReadOnlyTableService {
  /**
   * Past this many rows a table stops being read and starts being searched — the same point at which
   * every list in the console offers a search box.
   */
  private static readonly SEARCHABLE_TABLE_ROWS = 8;

  /** A table the operator will look THROUGH rather than read: it gets the filter above it. */
  static isSearchableTable(node: IStructuredNode): boolean {
    // Every table carries its search, not only a long one. A toolbar that appears once a list crosses
    // a line teaches the reader that this table is a different kind of thing from the one above it,
    // and leaves them hunting for a box that was there yesterday. The console this one is measured
    // against puts the same toolbar on a table of four rows and on a table of four hundred.
    return node.kind === StructuredNodeKind.ARRAY_TABLE && (node.tableRows ?? []).length > 1;
  }

  /**
   * The columns a table draws, in order: every key the rows hold that at least one row fills, pictures
   * first. Nothing is declared — the data says what the columns are, and the plugin's dictionary names them.
   */
  static columnsFor(node: IStructuredNode): string[] {
    const empty = node.tableEmptyColumns ?? [];
    return (node.tableColumns ?? []).filter((column) => !empty.includes(column));
  }

  /** Applies a screen's column order to the same structured rows used by the automatic table. */
  static applyLayout(node: IStructuredNode, layout: NonNullable<IField['admin']>['tableLayout']): IStructuredNode {
    if (!layout?.length || node.kind !== StructuredNodeKind.ARRAY_TABLE) return node;
    const media = layout.filter((column) => column.media).map((column) => column.key);
    const columns = layout.flatMap(({ key }) => {
      const children = (node.tableColumns ?? []).filter((column) => node.tableColumnOrigins?.[column] === key);
      return children.length ? children : [key];
    });
    const rows = (node.tableRows ?? []).map((row, index) => {
      const values = { ...row };
      for (const { key, join } of layout) {
        if (!join) continue;
        const group = node.items?.[index]?.entries?.find((entry) => entry.key === join.from)?.node;
        const title = group?.entries?.map((entry) => StructuredReadOnlyTableService.cellText(entry.node))
          .filter(Boolean).join(join.separator);
        if (title) values[key] = { kind: StructuredNodeKind.SCALAR, scalarValue: title };
      }
      return values;
    });
    return { ...node, tableColumns: columns, tableRows: rows, tableMediaColumns: media, tableEmptyColumns: [] };
  }

  /** Past this many distinct values a column is searched, not picked from. */
  private static readonly FILTERABLE_VALUE_LIMIT = 12;
  /**
   * Below this many rows a table is read whole; nothing to narrow. It is the point at which the table
   * also gains its search, because the two answer the same question: four variants under a Filters
   * button is a control standing over a table you can take in at a glance.
   */
  private static readonly FILTERABLE_TABLE_ROWS = StructuredReadOnlyTableService.SEARCHABLE_TABLE_ROWS;

  /**
   * The columns worth offering as a filter, with the values they actually hold.
   *
   * Nothing is invented: the options ARE the values in the table, so a filter can never offer a state
   * no row is in. A column where every row says the same thing is left out — there is nothing to
   * narrow — and so is one with a different value in every row, which is what the search is for.
   */
  static filterableColumns(node: IStructuredNode, minimumRows = StructuredReadOnlyTableService.FILTERABLE_TABLE_ROWS): Array<{ column: string; values: string[] }> {
    const rows = node.tableRows ?? [];
    if (node.kind !== StructuredNodeKind.ARRAY_TABLE || rows.length < minimumRows) return [];
    const out: Array<{ column: string; values: string[] }> = [];
    for (const column of StructuredReadOnlyTableService.columnsFor(node)) {
      const seen: string[] = [];
      for (const row of rows) {
        const text = StructuredReadOnlyTableService.cellText(row[column]).trim();
        if (text && !seen.includes(text)) seen.push(text);
        if (seen.length > StructuredReadOnlyTableService.FILTERABLE_VALUE_LIMIT) break;
      }
      if (seen.length > 1 && seen.length <= StructuredReadOnlyTableService.FILTERABLE_VALUE_LIMIT) out.push({ column, values: seen });
    }
    return out;
  }

  /** One cell as the plain text a sort compares. */
  static cellText(node?: IStructuredNode): string {
    return StructuredReadOnlyTableService.nodeText(node);
  }

  /**
   * Whether a row of a table holds the text, in any of the columns being DRAWN. A search that found a
   * row by a value the table does not show leaves the reader looking for it.
   */
  static tableRowMatches(row: Record<string, IStructuredNode>, needle: string, columns?: readonly string[]): boolean {
    if (!needle) return true;
    const nodes = columns?.length ? columns.map((column) => row[column]) : Object.values(row);
    return nodes.some((node) => StructuredReadOnlyTableService.nodeText(node).toLowerCase().includes(needle));
  }

  /**
   * A node as plain text, in the words the operator sees.
   *
   * It used to come back lower-cased, because its first use was a search. Then a filter offered the
   * same text as its options and the panel read "s · m · l · xl · размер: s". Case belongs to the
   * value; the search lower-cases at the moment it compares.
   */
  private static nodeText(node?: IStructuredNode): string {
    if (!node) return '';
    if (node.kind === StructuredNodeKind.SCALAR) return String(node.scalarValue ?? '');
    if (node.kind === StructuredNodeKind.OBJECT) return (node.entries ?? []).map((entry) => `${entry.key} ${StructuredReadOnlyTableService.nodeText(entry.node)}`).join(' ');
    if (node.kind === StructuredNodeKind.ARRAY || node.kind === StructuredNodeKind.ARRAY_TABLE) return (node.items ?? []).map((item) => StructuredReadOnlyTableService.nodeText(item)).join(' ');
    return '';
  }
}

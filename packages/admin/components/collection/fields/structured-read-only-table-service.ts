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
   * The columns a table draws, in order.
   *
   * `declared` is the owning field's `admin.tableColumns`: the plugin says WHICH of its keys a reader
   * needs at a glance and in what order, because only the plugin knows that a variant is read by its
   * name, its article number and its options, while "default" and "popular" are settings one opens a
   * row to change. A key the rows do not hold is not drawn, and a declaration that matches nothing
   * is ignored rather than leaving an empty table. Nothing is hidden: every key is still in the
   * section's own editor, which the ⋯ of each row opens.
   */
  static columnsFor(node: IStructuredNode, declared?: readonly string[]): string[] {
    const present = node.tableColumns ?? [];
    // Nobody declared anything: the framework arranged this table by itself, so a column no row fills
    // is left out — it is a key of the payload, not a question anyone asked.
    const empty = node.tableEmptyColumns ?? [];
    if (!declared?.length) return present.filter((column) => !empty.includes(column));
    // A column that was split into one per key answers to the name the field asked for: a field that
    // declared `options` gets the columns `options` became, in the place it put them. A declared column
    // is drawn whether or not a row fills it: "no picture on any of them" is an answer, not an absence.
    const origins = node.tableColumnOrigins ?? {};
    const picked: string[] = [];
    for (const column of declared) {
      for (const name of present) {
        if (picked.includes(name)) continue;
        if (name === column || origins[name] === column) picked.push(name);
      }
    }
    return picked.length ? picked : present;
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
  static filterableColumns(node: IStructuredNode, declared?: readonly string[]): Array<{ column: string; values: string[] }> {
    const rows = node.tableRows ?? [];
    if (node.kind !== StructuredNodeKind.ARRAY_TABLE || rows.length < StructuredReadOnlyTableService.FILTERABLE_TABLE_ROWS) return [];
    const out: Array<{ column: string; values: string[] }> = [];
    for (const column of StructuredReadOnlyTableService.columnsFor(node, declared)) {
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

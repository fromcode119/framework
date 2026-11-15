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
    return node.kind === StructuredNodeKind.ARRAY_TABLE
      && (node.tableRows ?? []).length > StructuredReadOnlyTableService.SEARCHABLE_TABLE_ROWS;
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
  static filterableColumns(node: IStructuredNode): Array<{ column: string; values: string[] }> {
    const rows = node.tableRows ?? [];
    if (node.kind !== StructuredNodeKind.ARRAY_TABLE || rows.length < StructuredReadOnlyTableService.FILTERABLE_TABLE_ROWS) return [];
    const out: Array<{ column: string; values: string[] }> = [];
    for (const column of node.tableColumns ?? []) {
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

  /** Whether a row of a table holds the text, in any of its columns. */
  static tableRowMatches(row: Record<string, IStructuredNode>, needle: string): boolean {
    if (!needle) return true;
    return Object.values(row).some((node) => StructuredReadOnlyTableService.nodeText(node).toLowerCase().includes(needle));
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

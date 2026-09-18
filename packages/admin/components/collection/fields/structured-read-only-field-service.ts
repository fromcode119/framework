import { CoercionUtils } from '@fromcode119/core/client';
import type { IStructuredEntry } from '@/components/collection/fields/interfaces/structured-entry.interface';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp|gif|avif)$/i;
const LARGE_TOP_LEVEL_KEY_THRESHOLD = 25;
const LARGE_LEAF_VALUE_THRESHOLD = 150;

/**
 * Pure normalisation for `StructuredReadOnlyField`: turns an arbitrary field value (object, array,
 * scalar, or — some rows still store it this way — a JSON *string*) into a row tree the view layer
 * renders. Holds no React, no DOM; every method is a static, side-effect-free transform so it can be
 * unit tested without mounting anything.
 */
export class StructuredReadOnlyFieldService {
  /** Defensively resolve the raw field value into real data. A JSON string parses; a plain string stays a string. */
  static parse(raw: unknown): unknown {
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return CoercionUtils.parseJson(raw, raw);
  }

  /** Classify an already-parsed value into a row-tree node. */
  static classify(value: unknown): IStructuredNode {
    if (value === null || value === undefined) return { kind: 'empty' };
    if (Array.isArray(value)) return StructuredReadOnlyFieldService.classifyArray(value);
    if (typeof value === 'object') return StructuredReadOnlyFieldService.classifyObject(value as Record<string, unknown>);
    return { kind: 'scalar', scalarValue: value };
  }

  private static classifyObject(value: Record<string, unknown>): IStructuredNode {
    const keys = Object.keys(value);
    if (keys.length === 0) return { kind: 'empty' };
    const entries: IStructuredEntry[] = keys.map((key) => ({ key, node: StructuredReadOnlyFieldService.classify(value[key]) }));
    return { kind: 'object', entries };
  }

  private static classifyArray(value: unknown[]): IStructuredNode {
    if (value.length === 0) return { kind: 'empty' };
    const items = value.map((item) => StructuredReadOnlyFieldService.classify(item));
    const table = StructuredReadOnlyFieldService.buildTable(items);
    return table
      ? { kind: 'array-table', items, tableColumns: table.columns, tableRows: table.rows }
      : { kind: 'array', items };
  }

  /**
   * An array renders as a TABLE only when every item is a FLAT object (every value scalar/empty) —
   * that's what makes a timeline or a changelog scannable. One nested item and it falls back to
   * ordinary indexed rows instead.
   */
  private static buildTable(items: IStructuredNode[]): { columns: string[]; rows: Record<string, IStructuredNode>[] } | null {
    if (items.length === 0 || !items.every((item) => item.kind === 'object')) return null;
    const isFlat = items.every((item) => (item.entries ?? []).every((entry) => entry.node.kind === 'scalar' || entry.node.kind === 'empty'));
    if (!isFlat) return null;

    const columns: string[] = [];
    items.forEach((item) => {
      (item.entries ?? []).forEach((entry) => {
        if (!columns.includes(entry.key)) columns.push(entry.key);
      });
    });

    const rows = items.map((item) => {
      const row: Record<string, IStructuredNode> = {};
      columns.forEach((column) => {
        row[column] = item.entries?.find((entry) => entry.key === column)?.node ?? { kind: 'empty' };
      });
      return row;
    });

    return { columns, rows };
  }

  /** Top-level key/item count — the "(n keys)" a group label shows. */
  static topLevelCount(node: IStructuredNode): number {
    if (node.kind === 'object') return node.entries?.length ?? 0;
    if (node.kind === 'array' || node.kind === 'array-table') return node.items?.length ?? 0;
    return 0;
  }

  /** Total scalar leaf count across the whole tree, for the large-payload heuristic. */
  static leafCount(node: IStructuredNode): number {
    if (node.kind === 'scalar') return 1;
    if (node.kind === 'object') return (node.entries ?? []).reduce((sum, entry) => sum + StructuredReadOnlyFieldService.leafCount(entry.node), 0);
    if (node.kind === 'array' || node.kind === 'array-table') return (node.items ?? []).reduce((sum, item) => sum + StructuredReadOnlyFieldService.leafCount(item), 0);
    return 0;
  }

  static isLargePayload(node: IStructuredNode): boolean {
    return StructuredReadOnlyFieldService.topLevelCount(node) > LARGE_TOP_LEVEL_KEY_THRESHOLD
      || StructuredReadOnlyFieldService.leafCount(node) > LARGE_LEAF_VALUE_THRESHOLD;
  }

  static isLink(value: unknown): value is string {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
  }

  static isImageLink(value: unknown): boolean {
    return StructuredReadOnlyFieldService.isLink(value) && IMAGE_EXTENSION_PATTERN.test((value as string).trim());
  }

  /** Whether `key`, or anything under `node`, matches the (already lower-cased) filter text. */
  static matchesFilter(key: string, node: IStructuredNode, filterLower: string): boolean {
    if (!filterLower) return true;
    if (key.toLowerCase().includes(filterLower)) return true;
    if (node.kind === 'object') {
      return (node.entries ?? []).some((entry) => StructuredReadOnlyFieldService.matchesFilter(entry.key, entry.node, filterLower));
    }
    if (node.kind === 'array' || node.kind === 'array-table') {
      return (node.items ?? []).some((item, index) => StructuredReadOnlyFieldService.matchesFilter(`[${index}]`, item, filterLower));
    }
    return false;
  }
}

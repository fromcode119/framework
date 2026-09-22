import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import { CoercionUtils } from '@fromcode119/core/client';
import type { IStructuredEntry } from '@/components/collection/fields/interfaces/structured-entry.interface';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { TagFieldUtils } from '@/components/ui/tag-field/utils';

/**
 * Pure normalisation for `StructuredReadOnlyField`: turns an arbitrary field value (object, array,
 * scalar, or — some rows still store it this way — a JSON *string*) into a row tree the view layer
 * renders. Holds no React, no DOM; every method is a static, side-effect-free transform so it can be
 * unit tested without mounting anything.
 */
export class StructuredReadOnlyFieldService {
  /** What counts as an image URL when deciding to render a thumbnail rather than the raw string. */
  private static readonly IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp|gif|avif)$/i;
  /** Above this many top-level keys the tree renders collapsed, so a big blob does not fill the page. */
  private static readonly LARGE_TOP_LEVEL_KEY_THRESHOLD = 25;
  /** Above this many characters a leaf value is truncated with the full text behind a title. */
  private static readonly LARGE_LEAF_VALUE_THRESHOLD = 150;

  /** Defensively resolve the raw field value into real data. A JSON string parses; a plain string stays a string. */
  static parse(raw: unknown): unknown {
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return CoercionUtils.parseJson(raw, raw);
  }

  /** Classify an already-parsed value into a row-tree node. */
  static classify(value: unknown): IStructuredNode {
    if (value === null || value === undefined) return { kind: StructuredNodeKind.EMPTY };
    if (Array.isArray(value)) return StructuredReadOnlyFieldService.classifyArray(value);
    if (typeof value === 'object') return StructuredReadOnlyFieldService.classifyObject(value as Record<string, unknown>);
    return { kind: StructuredNodeKind.SCALAR, scalarValue: value };
  }

  private static classifyObject(value: Record<string, unknown>): IStructuredNode {
    const keys = Object.keys(value);
    if (keys.length === 0) return { kind: StructuredNodeKind.EMPTY };
    const entries: IStructuredEntry[] = keys.map((key) => ({ key, node: StructuredReadOnlyFieldService.classify(value[key]) }));
    return { kind: StructuredNodeKind.OBJECT, entries };
  }

  private static classifyArray(value: unknown[]): IStructuredNode {
    if (value.length === 0) return { kind: StructuredNodeKind.EMPTY };
    const items = value.map((item) => StructuredReadOnlyFieldService.classify(item));
    const table = StructuredReadOnlyFieldService.buildTable(items);
    return table
      ? { kind: StructuredNodeKind.ARRAY_TABLE, items, tableColumns: table.columns, tableRows: table.rows }
      : { kind: StructuredNodeKind.ARRAY, items };
  }

  /**
   * An array renders as a TABLE only when every item is a FLAT object (every value scalar/empty) —
   * that's what makes a timeline or a changelog scannable. One nested item and it falls back to
   * ordinary indexed rows instead.
   */
  private static buildTable(items: IStructuredNode[]): { columns: string[]; rows: Record<string, IStructuredNode>[] } | null {
    if (items.length === 0 || !items.every((item) => item.kind === StructuredNodeKind.OBJECT)) return null;
    const isFlat = items.every((item) => (item.entries ?? []).every((entry) => entry.node.kind === StructuredNodeKind.SCALAR || entry.node.kind === StructuredNodeKind.EMPTY));
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
        row[column] = item.entries?.find((entry) => entry.key === column)?.node ?? { kind: StructuredNodeKind.EMPTY };
      });
      return row;
    });

    return { columns, rows };
  }

  /** Top-level key/item count — the "(n keys)" a group label shows. */
  /**
   * A data key as a person reads it: `changedBy` → "Changed by", `taxRatePercent` → "Tax rate
   * percent". The raw keys were rendered verbatim in a monospace grey, which is what made this
   * control read as a debug dump rather than part of the admin — and a table header printed
   * `CHANGEDBY`, where uppercasing had eaten the word boundary.
   *
   * Only the DISPLAY changes. The value, the ordering and `Copy as JSON` all still carry the exact
   * keys, so anyone who needs the literal name to search the code still has it.
   */
  /**
   * A data key as a person reads it.
   *
   * `overrides` is the owning plugin's own vocabulary, taken from the field's `admin.keyLabels`. It
   * wins outright, because only the plugin knows that `codAmount` is a cash-on-delivery amount —
   * the framework must not, and used to carry a list of commerce and finance acronyms to fake it.
   */
  static keyLabel(key: string, overrides?: Record<string, string>): string {
    const raw = String(key ?? '').trim();
    // An array index (`[0]`) is not a word and must not be title-cased into one.
    if (!raw || /^\[\d+\]$/.test(raw)) return raw;

    const declared = overrides?.[raw];
    if (typeof declared === 'string' && declared.trim()) return declared.trim();

    return StructuredReadOnlyFieldService.restoreAcronyms(TagFieldUtils.toTitleCase(raw));
  }

  /**
   * Title-casing turns an acronym into a word: `cityId` became "City Id", which is not what anyone
   * calls it. Only GENERIC data vocabulary lives here.
   *
   * This list used to carry COD, VAT, IBAN, BIC, SKU, EAN, AWB, UIC and GTIN — commerce, finance and
   * logistics words, sitting in `packages/admin`, which is supposed to contain no business domain at
   * all. A plugin's vocabulary is the plugin's: it names its own keys through
   * `admin.keyLabels` on the field, and the framework renders whatever it is told.
   *
   * Whole words only, so `idempotencyKey` stays "Idempotency Key" and `avoid` stays "Avoid".
   */
  private static readonly GENERIC_ACRONYMS = ['ID', 'URL', 'URI'];

  private static restoreAcronyms(label: string): string {
    return label.replace(/\b[A-Za-z]+\b/g, (word) => {
      const match = StructuredReadOnlyFieldService.GENERIC_ACRONYMS.find((a) => a.toLowerCase() === word.toLowerCase());
      return match ?? word;
    });
  }

  static topLevelCount(node: IStructuredNode): number {
    if (node.kind === StructuredNodeKind.OBJECT) return node.entries?.length ?? 0;
    if (node.kind === StructuredNodeKind.ARRAY || node.kind === StructuredNodeKind.ARRAY_TABLE) return node.items?.length ?? 0;
    return 0;
  }

  /** Total scalar leaf count across the whole tree, for the large-payload heuristic. */
  static leafCount(node: IStructuredNode): number {
    if (node.kind === StructuredNodeKind.SCALAR) return 1;
    if (node.kind === StructuredNodeKind.OBJECT) return (node.entries ?? []).reduce((sum, entry) => sum + StructuredReadOnlyFieldService.leafCount(entry.node), 0);
    if (node.kind === StructuredNodeKind.ARRAY || node.kind === StructuredNodeKind.ARRAY_TABLE) return (node.items ?? []).reduce((sum, item) => sum + StructuredReadOnlyFieldService.leafCount(item), 0);
    return 0;
  }

  static isLargePayload(node: IStructuredNode): boolean {
    return StructuredReadOnlyFieldService.topLevelCount(node) > StructuredReadOnlyFieldService.LARGE_TOP_LEVEL_KEY_THRESHOLD
      || StructuredReadOnlyFieldService.leafCount(node) > StructuredReadOnlyFieldService.LARGE_LEAF_VALUE_THRESHOLD;
  }

  static isLink(value: unknown): value is string {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
  }

  static isImageLink(value: unknown): boolean {
    return StructuredReadOnlyFieldService.isLink(value) && StructuredReadOnlyFieldService.IMAGE_EXTENSION_PATTERN.test((value as string).trim());
  }

  /** Whether `key`, or anything under `node`, matches the (already lower-cased) filter text. */
  static matchesFilter(key: string, node: IStructuredNode, filterLower: string): boolean {
    if (!filterLower) return true;
    if (key.toLowerCase().includes(filterLower)) return true;
    if (node.kind === StructuredNodeKind.OBJECT) {
      return (node.entries ?? []).some((entry) => StructuredReadOnlyFieldService.matchesFilter(entry.key, entry.node, filterLower));
    }
    if (node.kind === StructuredNodeKind.ARRAY || node.kind === StructuredNodeKind.ARRAY_TABLE) {
      return (node.items ?? []).some((item, index) => StructuredReadOnlyFieldService.matchesFilter(`[${index}]`, item, filterLower));
    }
    return false;
  }
}

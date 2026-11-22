import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import { CoercionUtils } from '@fromcode119/core/client';
import type { IStructuredEntry } from '@/components/collection/fields/interfaces/structured-entry.interface';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import type { IStructuredTable } from '@/components/collection/fields/interfaces/structured-table.interface';
import { StructuredTableSplitService } from '@/components/collection/fields/structured-table-split-service';
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

  /**
   * Past this many values a recorded field stops being something anyone reads and becomes a page of
   * its own: a product's storefront snapshot printed 284 of them — the record a second time, with
   * every translation key and every metadata list — and made the product page 19 695px tall.
   */
  private static readonly OVERSIZED_LEAF_VALUE_THRESHOLD = 80;

  /** Defensively resolve the raw field value into real data. A JSON string parses; a plain string stays a string. */
  static parse(raw: unknown): unknown {
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return CoercionUtils.parseJson(raw, raw);
  }

  /**
   * The value with its words in the owner's language: a string that is exactly one of the owner's
   * `valueLabels` (`pending` → "Чакаща") is replaced by it, at any depth. The value stays untouched in
   * the record; only what is read is worded. A key is never renamed here — that is `keyLabels`.
   */
  static relabelValues(value: unknown, valueLabels?: Record<string, string>): unknown {
    if (!valueLabels || Object.keys(valueLabels).length === 0) return value;
    if (typeof value === 'string') return Object.prototype.hasOwnProperty.call(valueLabels, value) && valueLabels[value] ? valueLabels[value] : value;
    if (Array.isArray(value)) return value.map((entry) => StructuredReadOnlyFieldService.relabelValues(entry, valueLabels));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, StructuredReadOnlyFieldService.relabelValues(entry, valueLabels)]));
    }
    return value;
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
      ? { kind: StructuredNodeKind.ARRAY_TABLE, items, tableColumns: table.columns, tableRows: table.rows, tableColumnOrigins: table.columnOrigins, tableEmptyColumns: table.emptyColumns, tableMediaColumns: table.mediaColumns }
      : { kind: StructuredNodeKind.ARRAY, items };
  }

  /** A nested value small enough to be written WHOLE on one line keeps its row in the table. */
  private static readonly INLINE_ENTRY_LIMIT = 3;

  /**
   * A nested value as one line, or nothing when it cannot be written whole.
   *
   * Nothing is summarised away: a product's variant carries `options: { Size: "S" }`, and one line that
   * says `Size: S` holds every character the nested value holds. The moment it would not — a longer
   * object, an array of objects — this returns nothing and the array falls back to indexed rows, where
   * everything is still readable.
   */
  private static oneLine(node: IStructuredNode): IStructuredNode | null {
    if (node.kind === StructuredNodeKind.SCALAR || node.kind === StructuredNodeKind.EMPTY) return node;
    const scalarText = (item: IStructuredNode): string | null => (item.kind === StructuredNodeKind.EMPTY
      ? ''
      : item.kind === StructuredNodeKind.SCALAR ? String(item.scalarValue ?? '') : null);
    if (node.kind === StructuredNodeKind.OBJECT) {
      const entries = node.entries ?? [];
      if (!entries.length || entries.length > StructuredReadOnlyFieldService.INLINE_ENTRY_LIMIT) return null;
      const parts: string[] = [];
      for (const entry of entries) {
        const text = scalarText(entry.node);
        if (text === null) return null;
        parts.push(text ? `${entry.key}: ${text}` : entry.key);
      }
      // The entries ride along with the text they were folded into: a table cell draws them as one chip
      // per value (a variant's `Размер: S`), while every text path — search, sort, filter, Copy as JSON —
      // still reads the one line. Nothing is added or dropped either way.
      return { kind: StructuredNodeKind.SCALAR, scalarValue: parts.join(' · '), entries };
    }
    if (node.kind === StructuredNodeKind.ARRAY || node.kind === StructuredNodeKind.ARRAY_TABLE) {
      const items = node.items ?? [];
      if (!items.length || items.length > StructuredReadOnlyFieldService.INLINE_ENTRY_LIMIT) return null;
      const parts: string[] = [];
      for (const item of items) {
        const text = scalarText(item);
        if (text === null) return null;
        parts.push(text);
      }
      return { kind: StructuredNodeKind.SCALAR, scalarValue: parts.join(', ') };
    }
    return null;
  }

  /**
   * An array renders as a TABLE when every item is an object and every value in it can be written on
   * one line — a scalar, or a nested value small enough to be shown whole (see {@link oneLine}).
   *
   * It used to demand that every value be a scalar, and one nested key sent the whole array back to
   * indexed rows: a product with four variants printed fourteen label/value rows per variant, 2 457px
   * of them, because each variant carries `options`. A list of four things is a table of four rows.
   */
  private static buildTable(items: IStructuredNode[]): IStructuredTable | null {
    if (items.length === 0 || !items.every((item) => item.kind === StructuredNodeKind.OBJECT)) return null;
    const inlined = new Map<IStructuredNode, IStructuredNode>();
    for (const item of items) {
      for (const entry of item.entries ?? []) {
        const line = StructuredReadOnlyFieldService.oneLine(entry.node);
        if (!line) return null;
        inlined.set(entry.node, line);
      }
    }

    const columns: string[] = [];
    items.forEach((item) => {
      (item.entries ?? []).forEach((entry) => {
        if (!columns.includes(entry.key)) columns.push(entry.key);
      });
    });

    // Which columns no row fills. A value nobody has recorded is noise: a product's variants carry
    // fourteen keys and an arbitrary payload has more, so a column no row fills is not drawn.
    const holdsSomething = (node?: IStructuredNode): boolean => {
      if (!node || node.kind === StructuredNodeKind.EMPTY) return false;
      // A blank string is no value either, however it was stored.
      if (node.kind === StructuredNodeKind.SCALAR) return String(node.scalarValue ?? '').trim() !== '';
      return true;
    };
    // A switch nobody turned on in any row says nothing a reader needs: a column of "No" is a setting's
    // resting state, not a fact about these rows. One row turned on and the column is drawn whole.
    const allOff = (column: string): boolean => items.every((item) => {
      const node = item.entries?.find((entry) => entry.key === column)?.node;
      return !node || node.kind === StructuredNodeKind.EMPTY || (node.kind === StructuredNodeKind.SCALAR && node.scalarValue === false);
    });
    const empty = columns.filter((column) => allOff(column) || !items.some((item) => holdsSomething(item.entries?.find((entry) => entry.key === column)?.node)));

    const rows = items.map((item) => {
      const row: Record<string, IStructuredNode> = {};
      columns.forEach((column) => {
        const found = item.entries?.find((entry) => entry.key === column)?.node;
        row[column] = found ? (inlined.get(found) ?? found) : { kind: StructuredNodeKind.EMPTY };
      });
      return row;
    });

    // A column is a picture when what it holds IS a picture — never because a field said so. Such a
    // column leads the row, the way every catalogue table opens on its thumbnail.
    const media = columns.filter((column) => rows.some((row) => {
      const node = row[column];
      return node?.kind === StructuredNodeKind.SCALAR && StructuredReadOnlyFieldService.isImagePath(String(node.scalarValue ?? '').trim());
    }));
    const ordered = [...media, ...columns.filter((column) => !media.includes(column))];
    return { ...StructuredTableSplitService.split(items, ordered, rows), emptyColumns: empty, mediaColumns: media };
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
   * `overrides` is the owning plugin's own vocabulary, read from its dictionary (`fields.<field>.keyLabels`). It
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
   * all. A plugin's vocabulary is the plugin's: it names its own keys in its dictionary, under
   * `fields.<field>.keyLabels`, and the framework renders whatever it is told.
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

  /** A list holding only plain values (no objects, no nested lists, nothing absent) — shown as chips. */
  static isValueList(node: IStructuredNode): boolean {
    return node.kind === StructuredNodeKind.ARRAY
      && (node.items ?? []).length > 0
      && (node.items ?? []).every((item) => item.kind === StructuredNodeKind.SCALAR);
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

  /** The values of this level itself, without what nests under them. */
  static ownLeafCount(node: IStructuredNode): number {
    if (node.kind === StructuredNodeKind.SCALAR) return 1;
    const children = node.kind === StructuredNodeKind.OBJECT
      ? (node.entries ?? []).map((entry) => entry.node)
      : (node.items ?? []);
    return children.filter((child) => child.kind === StructuredNodeKind.SCALAR || child.kind === StructuredNodeKind.EMPTY).length;
  }

  /** More values than anyone reads at once: the field opens on its own level and its filter finds the rest. */
  static isOversized(node: IStructuredNode): boolean {
    return StructuredReadOnlyFieldService.leafCount(node) > StructuredReadOnlyFieldService.OVERSIZED_LEAF_VALUE_THRESHOLD;
  }

  /**
   * From this many values a stored object is no longer a card's content: it is told as one row that opens
   * a drawer (`RecordSummaryRow`). An order's record printed 166 of them and its "order data" 24 more,
   * 3 400px of keys beside a 500px order. The number is a reading limit, not a style — a card of twelve
   * label / value rows still fits one screen.
   */
  private static readonly SUMMARY_LEAF_THRESHOLD = 12;

  /** Whether this value is too big for a card and is told as a summary row opening a drawer. */
  static needsSummary(node: IStructuredNode): boolean {
    if (node.kind !== StructuredNodeKind.OBJECT) return false;
    return StructuredReadOnlyFieldService.leafCount(node) > StructuredReadOnlyFieldService.SUMMARY_LEAF_THRESHOLD;
  }

  /**
   * The top level of an object split into the keys the owner has NAMED (its dictionary's `keyLabels`) and
   * the ones it has not. Named ones are what a person reads; the rest are the system's own bookkeeping,
   * drawn under their own heading so their number is visible instead of being mixed into the rest.
   * Without any `keyLabels` everything is "named": nothing is hidden or reordered for a field that never
   * declared a vocabulary.
   */
  static splitByLabel(node: IStructuredNode, keyLabels?: Record<string, string>): { named: IStructuredNode; technical: IStructuredNode | null } {
    if (node.kind !== StructuredNodeKind.OBJECT || !keyLabels || Object.keys(keyLabels).length === 0) return { named: node, technical: null };
    const entries = node.entries ?? [];
    const named = entries.filter((entry) => typeof keyLabels[entry.key] === 'string' && keyLabels[entry.key].trim());
    const technical = entries.filter((entry) => !named.includes(entry));
    return {
      named: { kind: StructuredNodeKind.OBJECT, entries: named },
      technical: technical.length ? { kind: StructuredNodeKind.OBJECT, entries: technical } : null,
    };
  }

  static isLink(value: unknown): value is string {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
  }

  /**
   * A picture of this site, written as the path it is served from (`/uploads/variant-s.webp`) rather
   * than a full address — what a plugin stores when the file lives on the installation itself.
   */
  static isImagePath(value: unknown): boolean {
    if (StructuredReadOnlyFieldService.isImageLink(value)) return true;
    if (typeof value !== 'string') return false;
    const text = value.trim();
    return text.startsWith('/') && !text.startsWith('//') && StructuredReadOnlyFieldService.IMAGE_EXTENSION_PATTERN.test(text);
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

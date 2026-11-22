import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

/**
 * How a stored value too big for a card is told: as one summary row, with the keys the owner named
 * apart from the system's own, and its words in the owner's language. Pure, like
 * {@link StructuredReadOnlyFieldService}, which it reads.
 */
export class StructuredReadOnlySummaryService {
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
    return StructuredReadOnlyFieldService.leafCount(node) > StructuredReadOnlySummaryService.SUMMARY_LEAF_THRESHOLD;
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

  /**
   * The value with its words in the owner's language: a string that is exactly one of the owner's
   * `valueLabels` (`pending` → "Чакаща") is replaced by it, at any depth. The value stays untouched in
   * the record; only what is read is worded. A key is never renamed here — that is `keyLabels`.
   */
  static relabelValues(value: unknown, valueLabels?: Record<string, string>): unknown {
    if (!valueLabels || Object.keys(valueLabels).length === 0) return value;
    if (typeof value === 'string') return Object.prototype.hasOwnProperty.call(valueLabels, value) && valueLabels[value] ? valueLabels[value] : value;
    if (Array.isArray(value)) return value.map((entry) => StructuredReadOnlySummaryService.relabelValues(entry, valueLabels));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, StructuredReadOnlySummaryService.relabelValues(entry, valueLabels)]));
    }
    return value;
  }

}

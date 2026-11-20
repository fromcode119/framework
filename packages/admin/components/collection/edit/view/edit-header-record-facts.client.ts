import { TimezoneUtils } from '@/lib/timezone';
import { ReadOnlyFieldValue } from '@/components/collection/view/read-only-field-value.client';
import { FieldDisplayLabel } from '@/lib/collection/field-display-label';

/**
 * What the header card says about a record besides its title: the line under it, and the state badges
 * beside it.
 *
 * A collection declares both in `admin.record`: `meta` names the fields for the line (an order's date and
 * where it came from), `badges` the select fields shown as badges in their option's `tone` (whether it is
 * paid, whether it has shipped). Without that declaration the line falls back to the fields the list
 * shows beside each record (`admin.list.meta`) and the header shows the record's own `status`.
 */
export class EditHeaderRecordFacts {
  static of(collection: any, formData: Record<string, unknown> | null | undefined): string[] {
    const declared = collection?.admin?.record?.meta;
    const names: string[] = Array.isArray(declared) ? declared : Array.isArray(collection?.admin?.list?.meta) ? collection.admin.list.meta : [];
    return names
      .map((name) => {
        const field = EditHeaderRecordFacts.field(collection, name);
        if (!field) return '';
        const value = formData?.[name];
        const text = (EditHeaderRecordFacts.longDate(field, value) ?? ReadOnlyFieldValue.describe(field, value)).trim();
        return text ? EditHeaderRecordFacts.named(field, text) : '';
      })
      .filter(Boolean);
  }

  /**
   * A number says what it counts.
   *
   * A product's line read "PS0427 · 0": the SKU speaks for itself, and the second fact was a bare
   * digit. The row of the same product in the list reads "Наличност 0", because a list labels its
   * values — the header did not, so the one fact that needed a word was the one without it.
   *
   * A value that is a number or a yes/no carries its field's name; text, a date, a state or anything
   * else already says what it is, and repeating the name would only make the line longer.
   */
  private static named(field: any, text: string): string {
    const kind = String(field?.type || '');
    if (!['number', 'boolean', 'checkbox'].includes(kind)) return text;
    const label = FieldDisplayLabel.of(field).trim();
    return label ? `${label} ${text}` : text;
  }

  /** The declared state badges with a value, each in its option's tone; null when the collection declares none. */
  static badges(collection: any, formData: Record<string, unknown> | null | undefined): Array<{ key: string; label: string; tone: string }> | null {
    const declared = collection?.admin?.record?.badges;
    if (!Array.isArray(declared)) return null;
    return declared
      .map((name: string) => {
        const field = EditHeaderRecordFacts.field(collection, name);
        const value = formData?.[name];
        if (!field || value === undefined || value === null || value === '') return null;
        const option = (field.options || []).find((candidate: any) => String(candidate?.value) === String(value));
        const label = ReadOnlyFieldValue.describe(field, value).trim();
        return label ? { key: name, label, tone: String(option?.tone || 'default') } : null;
      })
      .filter((badge: any): badge is { key: string; label: string; tone: string } => Boolean(badge));
  }

  /**
   * A date reads as words in a heading ("13 ноември 2026 г., 14:40"), not as the form's digits and seconds —
   * in the site's timezone, as the list, the fields and the history below it read the same moment. A plain
   * `Intl.DateTimeFormat` used the browser's zone, so an order's heading said 21:14 above a history at 20:14.
   */
  private static longDate(field: any, value: unknown): string | null {
    if (field?.type !== 'date' && field?.type !== 'datetime') return null;
    const text = TimezoneUtils.formatSystemDate(value, { dateStyle: 'long', timeStyle: field.type === 'datetime' ? 'short' : undefined }, '');
    return text || null;
  }

  private static field(collection: any, name: string): any {
    return (collection?.fields || []).find((candidate: any) => candidate?.name === name);
  }
}

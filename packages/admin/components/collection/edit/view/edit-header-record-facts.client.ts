import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ReadOnlyFieldValue } from '@/components/collection/view/read-only-field-value.client';

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
        return (EditHeaderRecordFacts.longDate(field, value) ?? ReadOnlyFieldValue.describe(field, value)).trim();
      })
      .filter(Boolean);
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

  /** A date reads as words in a heading ("13 ноември 2026 г., 14:40"), not as the form's digits and seconds. */
  private static longDate(field: any, value: unknown): string | null {
    if (field?.type !== 'date' && field?.type !== 'datetime') return null;
    const parsed = value ? new Date(String(value)) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return null;
    return new Intl.DateTimeFormat(AdminI18n.locale, { dateStyle: 'long', timeStyle: field.type === 'datetime' ? 'short' : undefined }).format(parsed);
  }

  private static field(collection: any, name: string): any {
    return (collection?.fields || []).find((candidate: any) => candidate?.name === name);
  }
}

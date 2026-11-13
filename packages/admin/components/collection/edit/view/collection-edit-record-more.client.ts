import { FieldLevel } from '@fromcode119/core/client';
import { CollectionEditFieldDepth } from '@/components/collection/edit/view/collection-edit-field-depth.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What a record page draws, and what it lists under "More".
 *
 * A record opens on its everyday fields (`admin.level`, undeclared = everyday). Every section that holds
 * a field above that is one row of the "More" card — its title and how many fields it adds — and the row
 * opens the section on its own page (`?section=<key>`) with ALL its fields. Nothing is folded away in
 * place and nothing is out of reach: each held-back field is one click from the record, under its name.
 *
 * A field the save depends on (one with an error, or required and still empty) is drawn on the record
 * itself whatever its level, so a save never fails on something the operator cannot see.
 */
export class CollectionEditRecordMore {
  static readonly PARAM = 'section';
  /** The record's own history (when it was made and changed, and its versions), opened like a section. */
  static readonly HISTORY = 'record-history';

  /** The section a `?section=` link asks for; '' on the record itself. */
  static focusKey(searchParams: URLSearchParams | null | undefined): string {
    return String(searchParams?.get(CollectionEditRecordMore.PARAM) || '').trim();
  }

  static title(section: { title?: string }): string {
    return String(section?.title || AdminI18n.t('collection.edit.content'));
  }

  /**
   * The sections to draw. Focused on a section that exists, that section alone with every field; else every
   * section narrowed to what the record shows, empty ones dropped.
   */
  static draw<T extends { key: string; fields: any[] }>(
    sections: T[], focus: string, formData: Record<string, unknown>, fieldErrors: Record<string, unknown>,
  ): T[] {
    if (focus) return sections.filter((section) => String(section.key) === focus);
    return sections
      .map((section) => ({ ...section, fields: section.fields.filter((field: any) => CollectionEditFieldDepth.shows(field, FieldLevel.EVERYDAY, formData, fieldErrors)) }))
      .filter((section) => section.fields.length > 0);
  }

  /** One row per section holding fields the record does not draw: its key, title and how many. */
  static rows(
    sections: Array<{ key: string; title?: string; fields: any[] }>, formData: Record<string, unknown>, fieldErrors: Record<string, unknown>,
  ): Array<{ key: string; title: string; count: number }> {
    return sections
      .map((section) => ({
        key: String(section.key),
        title: CollectionEditRecordMore.title(section),
        count: section.fields.filter((field: any) => !CollectionEditFieldDepth.shows(field, FieldLevel.EVERYDAY, formData, fieldErrors)).length,
      }))
      .filter((row) => row.count > 0);
  }

  /** The focused section's title for the breadcrumb, or '' when the key names no section (a stale link). */
  static focusedTitle(sections: Array<{ key: string; title?: string }>, focus: string): string {
    if (focus === CollectionEditRecordMore.HISTORY) return AdminI18n.t('collection.edit.versions');
    const found = focus ? sections.find((section) => String(section.key) === focus) : undefined;
    return found ? CollectionEditRecordMore.title(found) : '';
  }
}

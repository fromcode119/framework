import { FieldLevel } from '@fromcode119/core/client';
import { CollectionEditFieldDepth } from '@/components/collection/edit/view/collection-edit-field-depth.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What a record page draws, and what it lists under "More".
 *
 * A record opens on its everyday fields (`admin.level`, undeclared = everyday). Every section that holds
 * a field above that is one row of the ⋯ menu's "More" — its title and how many fields it adds. Choosing
 * a row OPENS that section in place: the record stays whole, the section is drawn with all its fields
 * where the collection declares it, and the page scrolls to it. Opened sections are named in the address
 * (`?section=<key>,<key>`), so a reload or a shared link shows the same page.
 *
 * Opening one section on a page of its own was tried and rejected: the record disappeared around a small
 * card of three fields, which read as if everything else had been removed.
 *
 * A field the save depends on (one with an error, or required and still empty) is drawn on the record
 * itself whatever its level, so a save never fails on something the operator cannot see.
 */
export class CollectionEditRecordMore {
  static readonly PARAM = 'section';
  /** The record's own history (when it was made and changed, and its versions), opened like a section. */
  static readonly HISTORY = 'record-history';

  /** The sections the address opens; none on the record as it first opens. */
  static openKeys(searchParams: URLSearchParams | null | undefined): string[] {
    return String(searchParams?.get(CollectionEditRecordMore.PARAM) || '')
      .split(',').map((key) => key.trim()).filter(Boolean);
  }

  /** The address with one more section opened. */
  static hrefOpening(recordHref: string, opened: string[], key: string): string {
    const keys = opened.includes(key) ? opened : [...opened, key];
    return `${recordHref}?${CollectionEditRecordMore.PARAM}=${keys.map(encodeURIComponent).join(',')}`;
  }

  /**
   * The element a section is drawn in, to scroll to once it is open. A side section is listed here as
   * `side:<title>` but its card is drawn as `sidebar-<title>` (the key its edit sheet answers to).
   */
  static anchorId(key: string): string {
    const side = 'side:';
    return key.startsWith(side) ? `section-sidebar-${key.slice(side.length)}` : `section-${key}`;
  }

  static title(section: { title?: string }): string {
    return String(section?.title || AdminI18n.t('collection.edit.content'));
  }

  /** Every section: an opened one with all its fields, the others narrowed to what the record shows. */
  static draw<T extends { key: string; fields: any[] }>(
    sections: T[], opened: string[], formData: Record<string, unknown>, fieldErrors: Record<string, unknown>,
  ): T[] {
    return sections
      .map((section) => (opened.includes(String(section.key))
        ? section
        : { ...section, fields: section.fields.filter((field: any) => CollectionEditFieldDepth.shows(field, FieldLevel.EVERYDAY, formData, fieldErrors)) }))
      .filter((section) => section.fields.length > 0);
  }

  /** One row per section, not yet opened, holding fields the record does not draw: its key, title and how many. */
  static rows(
    sections: Array<{ key: string; title?: string; fields: any[] }>, opened: string[], formData: Record<string, unknown>, fieldErrors: Record<string, unknown>,
  ): Array<{ key: string; title: string; count: number }> {
    return sections
      .filter((section) => !opened.includes(String(section.key)))
      .map((section) => ({
        key: String(section.key),
        title: CollectionEditRecordMore.title(section),
        count: section.fields.filter((field: any) => !CollectionEditFieldDepth.shows(field, FieldLevel.EVERYDAY, formData, fieldErrors)).length,
      }))
      .filter((row) => row.count > 0);
  }
}

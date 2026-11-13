/**
 * How a section of a saved record splits between what its card SHOWS and what its edit sheet EDITS.
 *
 * A saved record is read first and changed a piece at a time: the card lists the values that are set,
 * and "Edit" opens the section's own fields in a sheet. A field that brings its own component (an items
 * table, a media gallery) is its own interface and stays in the card, working as it always did.
 */
export class RecordSectionFields {
  /** A field drawn by its own component — it is shown and used in place, never moved into the sheet. */
  static ownsItsControl(field: any): boolean {
    return Boolean(field?.admin?.component);
  }

  /** The fields the section's sheet holds: every field that is not its own interface. */
  static sheetFields(fields: any[]): any[] {
    return (fields || []).filter((field) => !RecordSectionFields.ownsItsControl(field));
  }

  /**
   * Whether the sheet can change anything. A field locked for good (`readOnlyOverride: 'never'`) is
   * only ever read, so a section of nothing else offers no Edit.
   */
  static canEdit(fields: any[]): boolean {
    return RecordSectionFields.sheetFields(fields).some((field) => {
      if (!field?.admin?.readOnly) return true;
      const override = field.admin.readOnlyOverride;
      return override !== false && override !== 'never';
    });
  }

  /**
   * A value that says nothing: absent, blank, an empty list or object, or a switch left off. Such a
   * field is not listed on the card; the sheet still shows it, so nothing is out of reach.
   */
  static isEmpty(field: any, value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'boolean') return value === false && ['boolean', 'checkbox'].includes(String(field?.type || ''));
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every((item) => RecordSectionFields.isEmpty(null, item));
    return false;
  }

  /** A required field with no value — listed anyway, so what still has to be filled in is never out of sight. */
  static isMissing(field: any, value: unknown): boolean {
    return Boolean(field?.required) && RecordSectionFields.isEmpty(field, value);
  }

  /** The fields listed on the card, in the section's order: those with a value, and required ones without. */
  static shownFields(fields: any[], record: Record<string, any>): any[] {
    return RecordSectionFields.sheetFields(fields).filter((field) => {
      const value = record?.[field.name];
      return !RecordSectionFields.isEmpty(field, value) || RecordSectionFields.isMissing(field, value);
    });
  }

  /** The current values of the sheet's fields, so Cancel can put them back exactly. */
  static snapshot(fields: any[], record: Record<string, any>): Record<string, any> {
    const values: Record<string, any> = {};
    for (const field of RecordSectionFields.sheetFields(fields)) values[field.name] = record?.[field.name];
    return values;
  }
}

/**
 * How a section of a saved record splits between what its card SHOWS and what its edit sheet EDITS.
 *
 * A saved record is read first and changed a piece at a time: the card lists the values that are set,
 * and "Edit" opens the section's own fields in a sheet. A field that brings its own component (an items
 * table, a media gallery) is its own interface and stays in the card, working as it always did — unless
 * it declares how it reads (`admin.readComponent`, `admin.readAsValue`): then the card shows that and the
 * component edits it in the sheet with the rest of the section.
 */
export class RecordSectionFields {
  /** The console's components that only SHOW a recorded value: there is nothing in them to edit. */
  private static readonly DISPLAY_COMPONENTS = new Set(['StructuredReadOnlyField']);

  /** A field drawn by its own component — it is shown and used in place, never moved into the sheet. */
  static ownsItsControl(field: any): boolean {
    return Boolean(field?.admin?.component) && !field?.admin?.readComponent && !field?.admin?.readAsValue && !field?.admin?.readBy
      && !RecordSectionFields.displaysOnly(field);
  }

  /**
   * A field whose component only shows what the runtime recorded (a snapshot, a history) or is locked for
   * good: the card shows it under its own name, and the sheet leaves it out, because nothing in it can be
   * changed there.
   */
  static displaysOnly(field: any): boolean {
    const admin = field?.admin;
    if (!admin?.component || admin.readComponent || admin.readAsValue || admin.readBy) return false;
    if (RecordSectionFields.DISPLAY_COMPONENTS.has(String(admin.component))) return true;
    // A locked component that nobody unlocks (only a declared override, such as a password, opens it).
    return admin.readOnly === true && !RecordSectionFields.declaresUnlock(field);
  }

  /** The display-only fields of a section that hold something, in the section's order. */
  static displayFields(fields: any[], record: Record<string, any>): any[] {
    return (fields || []).filter((field) => RecordSectionFields.displaysOnly(field) && !RecordSectionFields.isEmpty(field, record?.[field.name]));
  }

  /** A field the card draws through its read component, not as a row. */
  static readsByComponent(field: any): boolean {
    return Boolean(field?.admin?.component && field?.admin?.readComponent);
  }

  /** The fields the section's sheet holds: every field that is not its own interface. */
  static sheetFields(fields: any[]): any[] {
    return (fields || []).filter((field) => !RecordSectionFields.ownsItsControl(field) && !RecordSectionFields.displaysOnly(field));
  }

  /**
   * Whether the sheet can change anything: a field that is not locked, or a locked one that declares how
   * it is opened (`readOnlyOverride: 'password'`). A section of fields the runtime writes, locked with no
   * declared way in, only reads — it offers no Edit that would open a column of locks.
   */
  static canEdit(fields: any[]): boolean {
    return RecordSectionFields.sheetFields(fields).some((field) => !field?.admin?.readOnly || RecordSectionFields.declaresUnlock(field));
  }

  private static declaresUnlock(field: any): boolean {
    const override = field?.admin?.readOnlyOverride;
    return typeof override === 'string' && override !== 'never';
  }

  /**
   * The fields the sheet draws: a locked field with nothing in it is left out — there is nothing to read
   * and nothing to type — unless it declares how it is opened.
   */
  static sheetDrawn(fields: any[], record: Record<string, any>): any[] {
    return RecordSectionFields.sheetFields(fields).filter((field) => !field?.admin?.readOnly
      || RecordSectionFields.declaresUnlock(field) || !RecordSectionFields.isEmpty(field, record?.[field.name]));
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

  /**
   * The fields listed on the card, in the section's order: those with a value, and required ones without.
   * A field another field's read component reads (`admin.readBy`) is shown there, not as a row.
   */
  static shownFields(fields: any[], record: Record<string, any>): any[] {
    return RecordSectionFields.sheetFields(fields).filter((field) => {
      if (RecordSectionFields.readsByComponent(field) || field?.admin?.readBy) return false;
      const value = record?.[field.name];
      return !RecordSectionFields.isEmpty(field, value) || RecordSectionFields.isMissing(field, value);
    });
  }

  /**
   * Everything the section draws while it is edited, in the section's order: what the card shows stays —
   * its own components, what it reads, what the runtime recorded, a locked value with its lock — and only
   * what can be changed becomes a control. Nothing is swapped for something else.
   */
  static editDrawn(fields: any[], record: Record<string, any>): any[] {
    const drawn = new Set(RecordSectionFields.sheetDrawn(fields, record));
    const recorded = new Set(RecordSectionFields.displayFields(fields, record));
    return (fields || []).filter((field) => drawn.has(field) || recorded.has(field) || RecordSectionFields.ownsItsControl(field));
  }

  /** The current values of the sheet's fields, so Cancel can put them back exactly. */
  static snapshot(fields: any[], record: Record<string, any>): Record<string, any> {
    const values: Record<string, any> = {};
    for (const field of fields || []) {
      if (!RecordSectionFields.displaysOnly(field)) values[field.name] = record?.[field.name];
    }
    return values;
  }
}

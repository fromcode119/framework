/**
 * How a section of a saved record splits between what its card SHOWS and what its edit sheet EDITS.
 *
 * A saved record is read first and changed a piece at a time: the card lists the values that are set,
 * and "Edit" opens the section's own fields in a sheet.
 *
 * A field that brings its own component is its own INTERFACE only when its value has a shape — a list of
 * tags, a block document, a relationship, a gallery. Carrying one for a plain value (a currency, a
 * colour, a locale, a slug) does not make it one: the card used to drop a live dropdown in the middle of
 * its read rows, under a heading of its own, after every value the record had — about a hundred fields
 * across the plugins do exactly this, and none of them declared the `readAsValue` that was meant to
 * prevent it. Those read as a value like every other field and are changed in the sheet with the rest.
 * A component that must be used in place although its value is plain (an editor, a canvas) says so with
 * `admin.inPlace: true`.
 */
export class RecordSectionFields {
  /** The console's components that only SHOW a recorded value: there is nothing in them to edit. */
  private static readonly DISPLAY_COMPONENTS = new Set(['StructuredReadOnlyField']);

  /**
   * Types whose component is the only way to READ the value: a picture, a block document, a name behind
   * an id. Drawn in place on a saved record, because there is nothing else to show.
   */
  private static readonly VISUAL_TYPES = new Set(['blocks', 'richText', 'relationship', 'media', 'upload']);

  /**
   * Types whose value is DATA — a list, a set of keyed values. The framework reads those itself, as the
   * table it already draws for any structured value.
   */
  private static readonly DATA_TYPES = new Set(['json', 'array']);

  /** A field drawn by its own component — it is shown and used in place, never moved into the sheet. */
  static ownsItsControl(field: any): boolean {
    if (!field?.admin?.component || field?.admin?.readComponent || field?.admin?.readAsValue || field?.admin?.readBy) return false;
    if (RecordSectionFields.displaysOnly(field)) return false;
    return field.admin.inPlace === true || RecordSectionFields.VISUAL_TYPES.has(String(field?.type || ''));
  }

  /**
   * The one rule a saved record follows: it SHOWS what is recorded, and the sheet is where it changes.
   *
   * A field whose value is data — a product's variants, its choices, its prices per currency — used to
   * draw its own editor on the record, so a saved product was a page of steppers, switches and bins
   * where an order of the same age was a page of values. That is the difference between the two screens,
   * and it was never a decision anybody took: it followed from "a structured type is its own interface",
   * which is true of a photograph and false of a list.
   *
   * Such a field is read here by the console's own structured renderer — the table it already draws for
   * any recorded value — and edited in the section's sheet with its real control. A plugin that means
   * its control to be used in place says so with `admin.inPlace`, and a plugin that has a better way to
   * read its value says so with `admin.readComponent`; both still win.
   */
  static readsAsData(field: any): boolean {
    if (!field?.admin?.component || field?.admin?.readComponent || field?.admin?.readAsValue || field?.admin?.readBy) return false;
    if (RecordSectionFields.displaysOnly(field) || field.admin.inPlace === true) return false;
    return RecordSectionFields.DATA_TYPES.has(String(field?.type || ''));
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

  /**
   * The display-only fields a section draws with their OWN component.
   *
   * A locked field used to qualify on the strength of being locked, and a component that does not
   * honour `readOnly` then drew its form anyway: a product's stock is locked, and its card still held
   * two steppers, a date picker, two switches and a Save button — 554px of form in a column meant for
   * short facts. Locked says who may change the value, not how it is read.
   *
   * So the component is drawn only where it IS the reading: the console's own display components, a
   * value whose shape needs it (a picture, a block document), or a plugin that says `inPlace`.
   * Everything else is read as a value, like every other fact on the card.
   */
  static displayFields(fields: any[], record: Record<string, any>): any[] {
    return (fields || []).filter((field) => RecordSectionFields.displaysOnly(field)
      && RecordSectionFields.readsThroughItsComponent(field)
      && !RecordSectionFields.isEmpty(field, record?.[field.name]));
  }

  /** Whether a field's own component is how the value READS, as opposed to how it is changed. */
  static readsThroughItsComponent(field: any): boolean {
    const admin = field?.admin;
    if (!admin?.component) return false;
    if (admin.inPlace === true) return true;
    if (RecordSectionFields.DISPLAY_COMPONENTS.has(String(admin.component))) return true;
    return RecordSectionFields.VISUAL_TYPES.has(String(field?.type || ''));
  }

  /** A field the card draws through its read component, not as a row. */
  static readsByComponent(field: any): boolean {
    return Boolean(field?.admin?.component && field?.admin?.readComponent);
  }

  /** The fields the section's sheet holds: every field that is not its own interface. */
  static sheetFields(fields: any[]): any[] {
    return (fields || []).filter((field) => !RecordSectionFields.ownsItsControl(field)
      && !(RecordSectionFields.displaysOnly(field) && RecordSectionFields.readsThroughItsComponent(field)));
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
    return RecordSectionFields.namedFields(fields).filter((field) => {
      const value = record?.[field.name];
      return !RecordSectionFields.isEmpty(field, value) || RecordSectionFields.isMissing(field, value);
    });
  }

  /**
   * The rows the section HAS, filled or not — {@link shownFields} without the test on the value.
   *
   * A section whose fields are all empty used to print one sentence ("nothing filled in yet") in place of
   * its content, so the one thing the reader needed — which fields this section even offers — was the one
   * thing the card would not say. Named with a dash each, the empty section states its own shape, exactly
   * as the filled one does, and the page stops having a second kind of card.
   */
  static namedFields(fields: any[]): any[] {
    return RecordSectionFields.sheetFields(fields).filter((field) => {
      if (RecordSectionFields.readsByComponent(field) || field?.admin?.readBy) return false;
      if (RecordSectionFields.readsAsData(field)) return false;
      // Drawn by its own component above, so not a row as well.
      if (RecordSectionFields.displaysOnly(field) && RecordSectionFields.readsThroughItsComponent(field)) return false;
      return true;
    });
  }

  /**
   * The rows an EMPTY section names: {@link namedFields}, and also the fields whose value would be read as
   * data (a table of variants, a list of choice groups).
   *
   * With a value those draw their own table, so they are not rows; with none they have nothing to draw,
   * and leaving them out would make a section whose only field is one of them say nothing at all. Named
   * with a dash the section still states what it holds — which is the whole point of the dash row.
   */
  static blankFields(fields: any[]): any[] {
    const named = new Set(RecordSectionFields.namedFields(fields));
    return RecordSectionFields.sheetFields(fields).filter((field) => named.has(field)
      || (RecordSectionFields.readsAsData(field) && !RecordSectionFields.readsByComponent(field) && !field?.admin?.readBy));
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

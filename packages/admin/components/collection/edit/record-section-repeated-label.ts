/**
 * A field named after the section it stands in loses its own label.
 *
 * The create form drew "Изображения" as the section's title and then "Изображения" again over the
 * control. The second says nothing the first had not, and a form reads as careless the moment it
 * repeats itself. The section's title IS the label there.
 */
export class RecordSectionRepeatedLabel {
  static apply(field: any, section: { title?: string; fields?: any[] }): any {
    const title = String(section?.title ?? '').trim();
    if (!title) return field;
    const label = String(field?.label ?? field?.admin?.label ?? '').trim();
    // Case and surrounding space are not a difference to anyone reading the screen.
    if (!label || label.localeCompare(title, undefined, { sensitivity: 'accent' }) !== 0) return field;
    return { ...field, admin: { ...(field.admin || {}), hideLabel: true } };
  }
}

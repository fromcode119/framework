/**
 * Which control a quick edit field is edited with, and whether it can be edited from the list at all.
 *
 * A control only changes HOW a value is typed, never what is stored: `textarea` for a text field,
 * `tags` for a many-relationship. One that would change the stored shape — `multiselect` on a
 * single-value select — is refused, because saving it would write a value the field does not hold.
 */
export class QuickEditControl {
  /** The field types each control can edit. */
  private static readonly SUITS: Record<string, readonly string[]> = {
    text: ['text', 'textarea', 'email'],
    textarea: ['text', 'textarea'],
    number: ['number'],
    select: ['select'],
    multiselect: ['select'],
    toggle: ['checkbox', 'boolean'],
    date: ['date', 'datetime'],
    relation: ['relationship'],
    tags: ['relationship'],
  };

  /** Types that need more room than a list row: a structured editor, a media picker, a password. */
  private static readonly TOO_BIG = ['json', 'array', 'richText', 'code', 'blocks', 'group', 'ui', 'password', 'upload'];

  /** Why `field` cannot be edited from the list, or '' when it can. */
  static refusal(field: any): string {
    if (!field) return 'is not a field of this collection';
    if (field.hidden || field.admin?.hidden) return 'is hidden';
    if (field.admin?.readOnly) return 'is read-only';
    const type = String(field.type);
    if (QuickEditControl.TOO_BIG.includes(type)) return `is a ${type} field, which only the full editor can change`;
    if (type === 'relationship' && field.relationTo === 'media') return 'is a media field, which only the full editor can change';
    return '';
  }

  /** Why `control` cannot edit `field`, or '' when it can. */
  static mismatch(field: any, control: string): string {
    const suits = QuickEditControl.SUITS[control];
    if (!suits) return `names an unknown control "${control}"`;
    if (!suits.includes(String(field.type))) return `is a ${field.type} field and cannot use the ${control} control`;
    if (control === 'multiselect' && !field.hasMany) return 'holds one value, so it cannot use the multiselect control';
    if (control === 'select' && field.hasMany) return 'holds several values, so it needs the multiselect control';
    if (control === 'tags' && !field.hasMany) return 'holds one value, so it cannot use the tags control';
    if (control === 'relation' && field.hasMany) return 'holds several values, so it needs the tags control';
    return '';
  }

  /** The field as the field renderer should draw it with `control`. */
  static apply(field: any, control?: string): any {
    if (control === 'textarea' && field.type !== 'textarea') {
      const localized = field.admin?.component === 'LocalizedText';
      return { ...field, type: 'textarea', admin: { ...field.admin, component: localized ? 'LocalizedTextarea' : field.admin?.component } };
    }
    if (control === 'text' && field.type === 'textarea') {
      const localized = field.admin?.component === 'LocalizedTextarea';
      return { ...field, type: 'text', admin: { ...field.admin, component: localized ? 'LocalizedText' : field.admin?.component } };
    }
    if (control === 'tags') return { ...field, admin: { ...field.admin, component: 'Tags' } };
    return field;
  }
}

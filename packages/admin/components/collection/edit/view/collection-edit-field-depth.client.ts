import { FieldLevel } from '@fromcode119/core/client';

/**
 * Which fields the edit form shows at a chosen depth, and how many each wider depth would add.
 *
 * A field declares `admin.level`; the form shows every field ranked at or below the depth the operator
 * chose. Two kinds of field are shown at EVERY depth, because withholding them would let a save fail on
 * something the operator cannot see: one carrying an error, and one that is required and still empty.
 */
export class CollectionEditFieldDepth {
  private static isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  }

  /** True when the field must be on screen whatever depth is chosen. */
  private static mustShow(field: any, formData: Record<string, unknown>, fieldErrors: Record<string, unknown>): boolean {
    if (fieldErrors?.[field.name]) return true;
    return field.required === true && CollectionEditFieldDepth.isEmpty(formData?.[field.name]);
  }

  static shows(field: any, depth: FieldLevel, formData: Record<string, unknown>, fieldErrors: Record<string, unknown>): boolean {
    return FieldLevel.resolve(field?.admin?.level).rank <= depth.rank
      || CollectionEditFieldDepth.mustShow(field, formData, fieldErrors);
  }

  /** How many of these fields sit at each level, keyed by the level's value. */
  static counts(fields: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const level of FieldLevel.ordered) counts[level.value] = 0;
    for (const field of fields) counts[FieldLevel.resolve(field?.admin?.level).value] += 1;
    return counts;
  }
}

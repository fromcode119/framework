import type { IField } from '@core/interfaces/field.interface';
import type { IJsonFieldReference } from '@core/interfaces/json-field-reference.interface';

/**
 * A field as a PLUGIN declares it, before the framework normalizes it.
 *
 * Identical to {@link IField} except every array is `readonly`. That is the whole difference, and it is
 * the only difference TypeScript needs: `readonly` PROPERTY modifiers are ignored when checking
 * assignability, so a deeply-frozen `as const` object assigns to a mutable one for free — but a
 * `readonly T[]` does NOT assign to `T[]`. Making the array containers readonly is therefore sufficient
 * to accept `as const` collection data, with no recursive mapped type involved.
 *
 * Recursive on purpose: `fields` nests for array/group fields, and an interface may reference itself.
 */
export interface IFieldInput extends Omit<IField, 'options' | 'relationTo' | 'fields' | 'inputAliases' | 'withheldWhen' | 'jsonReferences'> {
  /** `tone`: how a list shows the value as a badge (`success`, `warning`, `danger`, `info`, `default`). */
  readonly options?: readonly { readonly label: string; readonly value: any; readonly tone?: string }[];
  readonly relationTo?: string | readonly string[];
  readonly fields?: readonly IFieldInput[];
  readonly inputAliases?: readonly string[];
  readonly withheldWhen?: readonly string[];
  readonly jsonReferences?: readonly IJsonFieldReference[];
}

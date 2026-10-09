import type { ICollectionQuickEditField } from '@core/collections/interfaces/collection-quick-edit-field.interface';

/** What a collection lets the operator change from its admin list. */
export interface ICollectionQuickEdit {
  /** Fields whose value is edited in place by clicking it in the list. */
  readonly inline?: readonly string[];
  /** Fields of the form that opens under a row, in order. */
  readonly row?: readonly ICollectionQuickEditField[];
}

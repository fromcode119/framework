import type { ReactNode } from 'react';
import type { ICollectionEditSection } from '@/lib/appearance/interfaces/collection-edit-section.interface';

/**
 * What an appearance's own record editor is given: the record's layout, a way to draw each field, and
 * the page's own save and delete.
 *
 * The appearance owns the arrangement (its header, its cards, its buttons). The framework keeps
 * everything that decides what happens: each field is drawn by the admin's own `FieldRenderer` wired to
 * this page's state, `save` runs the same validated write as the standard editor, and `requestDelete`
 * opens the framework's own confirmation. Which actions are offered follows the person's role exactly as
 * on the standard page.
 */
export interface ICollectionEditController {
  /** The collection's admin metadata, as the standard editor reads it. */
  collection: Record<string, any>;
  /** The record's display title; empty for a record not yet saved. */
  title: string;
  isNew: boolean;
  /** The collection's list screen, for a back link. */
  listHref: string;
  /** Main sections first, then the ones the standard editor shows in its sidebar. */
  sections: ICollectionEditSection[];
  /** Draws one field from `sections` through the admin's own renderer, bound to this record. */
  renderField: (field: ICollectionEditSection['fields'][number]) => ReactNode;
  save: () => void;
  requestDelete: () => void;
  saving: boolean;
  /** Whether the form differs from the loaded or last saved record. */
  isDirty: boolean;
  /** The failure to show, already worded for a person. Empty when there is none. */
  error: string;
  /** A notice to show, such as "saved". Empty when there is none. */
  notice: string;
  canSave: boolean;
  canDelete: boolean;
}

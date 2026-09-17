import { Enum } from '@fromcode119/react-class-components';

/**
 * Whether the source editor is adding a source or changing one that exists.
 *
 * The difference is not cosmetic: on EDIT a blank token box means "unchanged" (the stored secret
 * never leaves the server), the slug and kind are already known, and saving targets an existing row.
 * On CREATE a blank token means there is no token. The screen asks this in four places — the dialog's
 * title, its description, the form's own help text and the save path — so it is named once.
 *
 * `null` is a third state and a real one: no editor is open at all.
 */
export class SourceEditorMode extends Enum {
  /** Adding a source this platform does not have. */
  static readonly CREATE = new SourceEditorMode('create');

  /** Changing one it already has. */
  static readonly EDIT = new SourceEditorMode('edit');

  private constructor(value: string) {
    super(value);
  }
}

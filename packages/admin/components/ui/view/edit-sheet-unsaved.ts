/**
 * Work inside an edit sheet that the sheet's own Save does not write.
 *
 * Some fields apply their changes through an action of their own — a correction that re-prices an order,
 * say — and keep what the operator typed in their own state until then. The sheet's Save submits the
 * form, which holds none of it: it reported success and closed, and the typed change was gone. Such a
 * field marks the block that holds its pending change with this attribute, its value saying what to do;
 * while one is on screen, Save submits nothing and shows that sentence instead.
 */
export class EditSheetUnsaved {
  static readonly ATTRIBUTE = 'data-fc-unsaved';

  /** The attribute to spread on the block that holds a pending change: `{...EditSheetUnsaved.mark(text)}`. */
  static mark(message: string): Record<string, string> {
    return { [EditSheetUnsaved.ATTRIBUTE]: message };
  }

  /** What the first pending block inside `root` asks for, or '' when nothing is pending. */
  static message(root: ParentNode | null | undefined): string {
    const held = root?.querySelector(`[${EditSheetUnsaved.ATTRIBUTE}]`);
    return held ? String(held.getAttribute(EditSheetUnsaved.ATTRIBUTE) || '').trim() : '';
  }
}

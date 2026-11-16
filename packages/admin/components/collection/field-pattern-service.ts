/**
 * A text field's declared shape, and the note shown when a value does not have it.
 *
 * A value the runtime cannot use must SAY so where it is typed. The alternative is what a product's
 * videos did before this existed: the plugin drew its own control for the sole purpose of printing
 * "not a YouTube or Vimeo link — the product page does not show it" under the box, so the field could
 * not simply declare what it holds. The field now declares `admin.pattern` and the words to show, and
 * every control that takes text obeys it.
 *
 * It never blocks typing or saving: a half-typed link matches nothing, and an operator pasting a link
 * a courier or a player will accept tomorrow is not to be argued with. It states what will happen.
 */
export class FieldPatternService {
  /** The note for this value, or null when there is nothing to say. */
  static noteFor(field: any, value: unknown): string | null {
    const pattern = field?.admin?.pattern;
    const note = field?.admin?.patternNote;
    if (typeof pattern !== 'string' || !pattern || typeof note !== 'string' || !note) return null;
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return null;
    const expression = FieldPatternService.compile(pattern);
    if (!expression) return null;
    return expression.test(text) ? null : note;
  }

  /** A bad pattern says nothing rather than throwing on every keystroke. */
  private static compile(pattern: string): RegExp | null {
    try {
      return new RegExp(pattern);
    } catch {
      return null;
    }
  }
}

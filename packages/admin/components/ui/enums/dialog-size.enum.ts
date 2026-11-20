import { Enum } from '@fromcode119/react-class-components';

/** How wide a {@link Dialog}'s panel is. Three widths, so no caller invents a fourth. */
export class DialogSize extends Enum {
  /** A question and two buttons. */
  static readonly SMALL = new DialogSize('sm');
  /** The default: a short list, a form of a few fields. */
  static readonly MEDIUM = new DialogSize('md');
  /** Something to look at: a preview, a revision beside the current values. */
  static readonly LARGE = new DialogSize('lg');

  private constructor(value: string) {
    super(value);
  }

  /** A plugin bundle passes a plain string and is never type-checked against the framework. */
  static resolve(value: unknown): string {
    if (value instanceof DialogSize) return value.value;
    const found = DialogSize.fromValue(String(value ?? '').trim().toLowerCase()) as DialogSize | undefined;
    return (found ?? DialogSize.MEDIUM).value;
  }
}

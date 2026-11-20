import { Enum } from '@fromcode119/react-class-components';

/** What a {@link Dialog}'s mark says about it: the tone of the icon tile beside the title. */
export class DialogTone extends Enum {
  /** Plain — the console's own quiet surface. */
  static readonly NEUTRAL = new DialogTone('neutral');
  /** Something is about to be lost. */
  static readonly DANGER = new DialogTone('danger');
  /** Something needs attention before it is done. */
  static readonly WARNING = new DialogTone('warning');
  /** The brand's own accent, for a dialog that offers rather than warns. */
  static readonly BRAND = new DialogTone('brand');

  private constructor(value: string) {
    super(value);
  }

  /** A plugin bundle passes a plain string and is never type-checked against the framework. */
  static resolve(value: unknown): string {
    if (value instanceof DialogTone) return value.value;
    const found = DialogTone.fromValue(String(value ?? '').trim().toLowerCase()) as DialogTone | undefined;
    return (found ?? DialogTone.NEUTRAL).value;
  }
}

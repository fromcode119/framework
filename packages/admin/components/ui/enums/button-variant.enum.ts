import { Enum } from '@fromcode119/reactor';

/** Style variant of an admin Button (also used by confirm dialogs). */
export class ButtonVariant extends Enum {
  static readonly PRIMARY = new ButtonVariant('primary');
  static readonly SECONDARY = new ButtonVariant('secondary');
  static readonly DANGER = new ButtonVariant('danger');
  static readonly GHOST = new ButtonVariant('ghost');
  static readonly OUTLINE = new ButtonVariant('outline');

  private constructor(value: string) {
    super(value);
  }
  /**
   * Resolve a raw value to a member; anything unrecognised is PRIMARY.
   *
   * A plugin bundle passes this as a plain string and is never type-checked against the framework.
   * `('solid').value` is `undefined`, so the style lookup missed and the element rendered with NO
   * variant class at all — silent, not a crash.
   */
  static resolve(value: unknown): ButtonVariant {
    if (value instanceof ButtonVariant) return value;
    const found = ButtonVariant.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ButtonVariant | undefined) ?? ButtonVariant.PRIMARY;
  }
}

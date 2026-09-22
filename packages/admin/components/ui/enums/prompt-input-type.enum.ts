import { Enum } from '@fromcode119/react-class-components';

/** Input type used by the prompt dialog. */
export class PromptInputType extends Enum {
  static readonly TEXT = new PromptInputType('text');
  static readonly PASSWORD = new PromptInputType('password');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve a raw value to a member.
   *
   * Every call site passes the plain literal (`inputType="password"`), and a string has no `.value` —
   * so `type={inputType.value}` rendered `undefined`, React dropped the attribute, and the browser
   * fell back to `text`. The read-only override dialog asked for the operator's ACCOUNT PASSWORD and
   * printed it on screen as they typed.
   *
   * An unrecognised value resolves to PASSWORD, not TEXT: the failure mode of this particular enum is
   * asymmetric — masking a field that did not need it costs nothing, revealing one that did is the
   * bug above.
   */
  static resolve(value: unknown): PromptInputType {
    if (value instanceof PromptInputType) return value;
    const found = PromptInputType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as PromptInputType | undefined) ?? PromptInputType.PASSWORD;
  }
}

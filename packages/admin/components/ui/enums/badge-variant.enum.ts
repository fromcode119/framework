import { Enum } from '@fromcode119/reactor';

/** Colour variant of an admin Badge. */
export class BadgeVariant extends Enum {
  static readonly SUCCESS = new BadgeVariant('success');
  static readonly WARNING = new BadgeVariant('warning');
  static readonly DANGER = new BadgeVariant('danger');
  static readonly INFO = new BadgeVariant('info');
  static readonly DEFAULT = new BadgeVariant('default');
  static readonly BLUE = new BadgeVariant('blue');
  static readonly GRAY = new BadgeVariant('gray');
  static readonly PURPLE = new BadgeVariant('purple');
  static readonly GREEN = new BadgeVariant('green');
  static readonly AMBER = new BadgeVariant('amber');

  private constructor(value: string) {
    super(value);
  }
  /**
   * Resolve a raw value to a member; anything unrecognised is DEFAULT.
   *
   * A plugin bundle passes this as a plain string and is never type-checked against the framework.
   * `('solid').value` is `undefined`, so the style lookup missed and the element rendered with NO
   * variant class at all — silent, not a crash.
   */
  static resolve(value: unknown): BadgeVariant {
    if (value instanceof BadgeVariant) return value;
    const found = BadgeVariant.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as BadgeVariant | undefined) ?? BadgeVariant.DEFAULT;
  }
}

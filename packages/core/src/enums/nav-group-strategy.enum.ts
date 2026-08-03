import { Enum } from '@fromcode119/reactor';

/** How an admin nav group renders its children. */
export class NavGroupStrategy extends Enum {
  static readonly DROPDOWN = new NavGroupStrategy('dropdown');
  static readonly SECTION = new NavGroupStrategy('section');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw value to a member; defaults to SECTION. */
  static resolve(value: unknown): NavGroupStrategy {
    if (value instanceof NavGroupStrategy) return value;
    const found = NavGroupStrategy.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as NavGroupStrategy | undefined) ?? NavGroupStrategy.SECTION;
  }
}

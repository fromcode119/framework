import { Enum } from '@fromcode119/reactor';

/** Where the resize handle sits. */
export class HandlePosition extends Enum {
  static readonly BOTTOM = new HandlePosition('bottom');
  static readonly TOP = new HandlePosition('top');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to BOTTOM. */
  static resolve(value: unknown): HandlePosition {
    if (value instanceof HandlePosition) return value;
    const found = HandlePosition.fromValue(String(value ?? '').trim());
    return (found as unknown as HandlePosition | undefined) ?? HandlePosition.BOTTOM;
  }
}

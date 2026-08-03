import { Enum } from '@fromcode119/reactor';

/** How the assistant handles ambiguous requests. */
export class ClarifyMode extends Enum {
  static readonly NONE = new ClarifyMode('none');
  static readonly CLARIFY = new ClarifyMode('clarify');
  static readonly BEST_EFFORT = new ClarifyMode('best_effort');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to NONE. */
  static resolve(value: unknown): ClarifyMode {
    if (value instanceof ClarifyMode) return value;
    const found = ClarifyMode.fromValue(String(value ?? '').trim());
    return (found as unknown as ClarifyMode | undefined) ?? ClarifyMode.NONE;
  }
}

import { Enum } from '@fromcode119/reactor';

/** How much context/capability a request is granted. */
export class ContextLevel extends Enum {
  static readonly BASIC = new ContextLevel('basic');
  static readonly ADVANCED = new ContextLevel('advanced');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to BASIC. */
  static resolve(value: unknown): ContextLevel {
    if (value instanceof ContextLevel) return value;
    const found = ContextLevel.fromValue(String(value ?? '').trim());
    return (found as unknown as ContextLevel | undefined) ?? ContextLevel.BASIC;
  }
}

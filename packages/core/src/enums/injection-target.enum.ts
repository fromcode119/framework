import { Enum } from '@fromcode119/reactor';

/** Where a plugin injects markup in the document. */
export class InjectionTarget extends Enum {
  static readonly HEAD = new InjectionTarget('head');
  static readonly BODY_START = new InjectionTarget('bodyStart');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/wire string to a member; defaults to HEAD. */
  static resolve(value: unknown): InjectionTarget {
    if (value instanceof InjectionTarget) return value;
    const found = InjectionTarget.fromValue(String(value ?? '').trim());
    return (found as InjectionTarget | undefined) ?? InjectionTarget.HEAD;
  }
}

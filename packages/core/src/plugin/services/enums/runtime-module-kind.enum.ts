import { Enum } from '@fromcode119/reactor';

/** Kind of runtime module registered in the shared runtime registry. */
export class RuntimeModuleKind extends Enum {
  static readonly ICON = new RuntimeModuleKind('icon');
  static readonly LIB = new RuntimeModuleKind('lib');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire/plugin string to a member; defaults to LIB. */
  static resolve(value: unknown): RuntimeModuleKind {
    if (value instanceof RuntimeModuleKind) return value;
    const found = RuntimeModuleKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as RuntimeModuleKind | undefined) ?? RuntimeModuleKind.LIB;
  }
}

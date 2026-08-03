import { Enum } from '@fromcode119/reactor';

/** Where a model runs. */
export class ModelLocation extends Enum {
  static readonly SERVER = new ModelLocation('server');
  static readonly LOCAL = new ModelLocation('local');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to SERVER. */
  static resolve(value: unknown): ModelLocation {
    if (value instanceof ModelLocation) return value;
    const found = ModelLocation.fromValue(String(value ?? '').trim());
    return (found as unknown as ModelLocation | undefined) ?? ModelLocation.SERVER;
  }
}

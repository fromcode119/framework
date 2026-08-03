import { Enum } from '@fromcode119/reactor';

/** Whether an entity parse is for a create or an update. */
export class EntityParseMode extends Enum {
  static readonly CREATE = new EntityParseMode('create');
  static readonly UPDATE = new EntityParseMode('update');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to CREATE. */
  static resolve(value: unknown): EntityParseMode {
    if (value instanceof EntityParseMode) return value;
    const found = EntityParseMode.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as EntityParseMode | undefined) ?? EntityParseMode.CREATE;
  }
}

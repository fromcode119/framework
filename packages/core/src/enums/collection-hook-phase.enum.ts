import { Enum } from '@fromcode119/react-class-components/lang';

/** Lifecycle point at which a collection hook runs. */
export class CollectionHookPhase extends Enum {
  static readonly BEFORE_CREATE = new CollectionHookPhase('beforeCreate');
  static readonly AFTER_CREATE = new CollectionHookPhase('afterCreate');
  static readonly BEFORE_UPDATE = new CollectionHookPhase('beforeUpdate');
  static readonly AFTER_UPDATE = new CollectionHookPhase('afterUpdate');
  static readonly BEFORE_SAVE = new CollectionHookPhase('beforeSave');
  /**
   * A GUARD, once per existing record, right before its update is written: the listener sees the
   * incoming changes AND the record as stored (`_previousData`) and refuses by throwing. Nothing it
   * returns is written — `beforeUpdate`/`beforeSave` transform, this only decides. It exists because
   * those two never see the stored record, so no rule of the form "this field may not change once
   * the record is X" could be enforced from a hook.
   */
  static readonly BEFORE_CHANGE = new CollectionHookPhase('beforeChange');
  static readonly AFTER_SAVE = new CollectionHookPhase('afterSave');
  static readonly BEFORE_DELETE = new CollectionHookPhase('beforeDelete');
  static readonly AFTER_DELETE = new CollectionHookPhase('afterDelete');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/theme/wire string to a member; defaults to BEFORE_CREATE. */
  static resolve(value: unknown): CollectionHookPhase {
    if (value instanceof CollectionHookPhase) return value;
    const found = CollectionHookPhase.fromValue(String(value ?? '').trim());
    return (found as CollectionHookPhase | undefined) ?? CollectionHookPhase.BEFORE_CREATE;
  }
}

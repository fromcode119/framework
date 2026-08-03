import { Enum } from '@fromcode119/reactor';

/** A normalization applied to an entity field value before it is persisted. */
export class EntityFieldTransform extends Enum {
  static readonly TRIM = new EntityFieldTransform('trim');
  static readonly LOWERCASE = new EntityFieldTransform('lowercase');
  static readonly UPPERCASE = new EntityFieldTransform('uppercase');
  static readonly ROUND2 = new EntityFieldTransform('round2');
  static readonly MIN0 = new EntityFieldTransform('min0');
  static readonly CURRENCY_OBJECT = new EntityFieldTransform('currencyObject');
  static readonly STRING_ARRAY = new EntityFieldTransform('stringArray');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw config string to a member, or `undefined` when it names no known transform. */
  static resolve(value: unknown): EntityFieldTransform | undefined {
    if (value instanceof EntityFieldTransform) return value;
    return EntityFieldTransform.fromValue(String(value ?? '').trim()) as EntityFieldTransform | undefined;
  }
}

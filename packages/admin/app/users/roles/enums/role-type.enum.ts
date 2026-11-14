import { Enum } from '@fromcode119/react-class-components';

/** A role the platform ships (`system`, never edited) or one an operator made (`custom`). */
export class RoleType extends Enum {
  static readonly SYSTEM = new RoleType('system');
  static readonly CUSTOM = new RoleType('custom');

  private constructor(value: string) {
    super(value);
  }

  /** A role with no type is one an operator made, as the API stores it. */
  static resolve(value: unknown): RoleType {
    if (value instanceof RoleType) return value;
    return (RoleType.fromValue(String(value ?? '').trim().toLowerCase()) as RoleType | undefined) ?? RoleType.CUSTOM;
  }
}

import { Enum } from '@fromcode119/react-class-components';

/**
 * The `state` column shared by tenant records, tenant memberships, and the per-tenant plugin and theme
 * rows. Was declared privately, and identically, in four separate classes (2026-09-09).
 *
 * Compare against `.value` — the rows hold raw strings, and an Enum instance tested against a string is
 * always false.
 */
export class TenantState extends Enum {
  static readonly ACTIVE = new TenantState('active');

  static readonly INACTIVE = new TenantState('inactive');

  private constructor(value: string) {
    super(value);
  }
}

import { Enum } from '@fromcode119/react-class-components';

/**
 * WHERE an archive's rows were read from.
 *
 * A site on a multi-tenant deployment (`TENANT`) and a whole single-tenant installation
 * (`SINGLE_TENANT`) produce the same archive format but are gathered differently: one is scoped to a
 * tenant id, the other takes the rows that belong to nobody. The distinction is recorded in the
 * manifest because an import has to know which it is holding.
 */
export class TenantArchiveKind extends Enum {
  /** One site of a multi-tenant deployment. */
  static readonly TENANT = new TenantArchiveKind('tenant');

  /** A whole installation that has no tenancy — its rows carry no tenant id. */
  static readonly SINGLE_TENANT = new TenantArchiveKind('single-tenant');

  private constructor(value: string) {
    super(value);
  }

  /** The member a stored or wire value names, or null when it names none. */
  static find(value: unknown): TenantArchiveKind | null {
    if (value instanceof TenantArchiveKind) return value;
    return (TenantArchiveKind.fromValue(String(value ?? '').trim().toLowerCase()) as TenantArchiveKind | undefined) ?? null;
  }
}

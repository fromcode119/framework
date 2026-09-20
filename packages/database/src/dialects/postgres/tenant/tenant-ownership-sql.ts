import { SqlIdentifier } from '@database/dialects/postgres/sql-identifier';
import { TenantColumn } from '@database/tenant/tenant-column';

/**
 * The statements that answer, and enforce, WHO OWNS A ROW.
 *
 * Separate from `TenantIsolationSql`, which is about what a site may READ. These are the other half:
 * whether a row is allowed to belong to nobody, and which sites a table's rows actually belong to
 * when the deployment is about to stop isolating them at all.
 *
 * Both questions share an awkward property that shapes every statement here — the caller is the table
 * OWNER and is deliberately NOSUPERUSER/NOBYPASSRLS, and these tables FORCE row-level security, which
 * is precisely what makes the policy apply to the owner too. So neither can be answered by a plain
 * SELECT, and each is asked in the only way that answers honestly.
 */
export class TenantOwnershipSql {
  /**
   * Makes the ownership column REQUIRED, so an unowned row stops being writable at all.
   *
   * The difference between reporting the fault and preventing it. The column is added nullable — it
   * has to be, to land on a populated table — and its default is the current tenant, which is NULL
   * outside a tenant scope. So an insert made with no site bound wrote a row no site could ever read,
   * and nothing refused it: 20 rows across 8 tables on a live platform, invisible from the moment they
   * were written. With NOT NULL that insert FAILS at the database instead. Row-level security stops a
   * site reading another site's row; this stops a row belonging to nobody being created at all.
   *
   * It is refused while such rows still exist, which is correct — the constraint is the thing that
   * tells you, and the fix is to give those rows an owner or remove them.
   */
  static requireOwnerStatement(table: string): string {
    const name = SqlIdentifier.assert(table, 'TenantOwnershipSql');
    return `ALTER TABLE "${name}" ALTER COLUMN "${TenantColumn.NAME}" SET NOT NULL`;
  }

  /** Whether the ownership column is already required — a catalog read, so the ALTER is not re-run every boot. */
  static ownerRequiredStatement(table: string): string {
    const name = SqlIdentifier.assert(table, 'TenantOwnershipSql');
    return 'SELECT a.attnotnull AS required FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid '
      + `JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname = '${name}' `
      + `AND a.attname = '${TenantColumn.NAME}' AND a.attnum > 0 LIMIT 1`;
  }

  /**
   * WHICH sites this table's rows belong to.
   *
   * Asked before isolation is ever removed. `_system_tenants` being empty is not the same as the DATA
   * belonging to one customer: deleting a site removes its row, not its rows, so a deployment can
   * reach zero tenants while its tables still hold several customers' records.
   *
   * FORCE is lifted for the duration because the answer is invisible otherwise — the caller is the
   * table owner, and FORCE is precisely what makes the policy apply to the owner too. It does not
   * widen anything for anyone else: row-level security applies to non-owner roles regardless, and the
   * runtime role is NOSUPERUSER/NOBYPASSRLS, so the app cannot see past its own site for a moment of
   * this. FORCE is put back before the answer is returned.
   */
  static distinctOwnerStatements(table: string): { relax: string; owners: string; restore: string } {
    const name = SqlIdentifier.assert(table, 'TenantOwnershipSql');
    return {
      relax: `ALTER TABLE "${name}" NO FORCE ROW LEVEL SECURITY`,
      // The ids themselves, not a count: two tables each owned by one site are still two sites, and a
      // count per table cannot tell that from the same site twice. Capped because the answer is only
      // ever "one, or more than one".
      owners: `SELECT DISTINCT "${TenantColumn.NAME}" AS owner FROM "${name}" `
        + `WHERE "${TenantColumn.NAME}" IS NOT NULL LIMIT 5`,
      restore: `ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`,
    };
  }
}

import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';
import { TenantColumn } from '@database/tenant/tenant-column';
import type { IScopedUniqueRules } from '@database/interfaces/scoped-unique-rules.interface';
import type { ITenantBlindUniqueRule } from '@database/interfaces/tenant-blind-unique-rule.interface';
import type { ITenantIsolation } from '@database/interfaces/tenant-isolation.interface';
import type { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';


/**
 * Tenant isolation as Postgres implements it: row-level security.
 *
 * Takes a RUNNER rather than the pool, for the same reason `PostgresRoleProvisioner` does — the
 * manager's `queryRaw` picks the right connection (the request's held client inside a tenant scope,
 * the pool otherwise), and this class must not make that choice for itself. Every statement it
 * issues therefore lands exactly where the same statement landed before this class existed.
 */
export class PostgresTenantIsolation implements ITenantIsolation {
  constructor(private readonly run: ISqlRunner) {}

  async addTenantColumn(table: string): Promise<void> {
    await this.runAll(TenantIsolationSql.columnStatementsFor(table));
  }

  async enforceIsolation(table: string): Promise<void> {
    await this.runAll(TenantIsolationSql.enforcementStatementsFor(table));
  }

  async isolateTable(table: string): Promise<void> {
    await this.runAll(TenantIsolationSql.statementsFor(table));
  }

  async releaseTable(table: string, policies: string[]): Promise<void> {
    await this.runAll(TenantIsolationSql.removalStatementsFor(table, policies));
  }

  async listPolicies(): Promise<Array<{ table: string; policy: string }>> {
    const rows = await this.run(TenantIsolationSql.isolatedPoliciesStatement());
    return (rows ?? [])
      .map((row) => ({
        table: String(row?.tablename ?? '').trim(),
        policy: String(row?.policyname ?? '').trim(),
      }))
      .filter((entry) => entry.table !== '' && entry.policy !== '');
  }

  async applyPolicy(spec: TenantPolicySpec): Promise<void> {
    await this.runAll(TenantIsolationSql.bespokePolicyStatements(spec));
  }

  async scopeUniqueRules(table: string): Promise<IScopedUniqueRules> {
    const scoped: IScopedUniqueRules = { constraints: [], indexes: [] };

    const constraints = await this.run(
      TenantIsolationSql.tenantBlindUniqueConstraintsStatement(),
      [table, TenantColumn.NAME],
    );
    for (const rule of PostgresTenantIsolation.rulesOf(constraints)) {
      await this.run(TenantIsolationSql.scopeUniqueConstraintStatement(table, rule.name, rule.columns));
      scoped.constraints.push(rule);
    }

    const indexes = await this.run(
      TenantIsolationSql.tenantBlindUniqueIndexesStatement(),
      [table, TenantColumn.NAME],
    );
    for (const rule of PostgresTenantIsolation.rulesOf(indexes)) {
      await this.runAll(TenantIsolationSql.scopeUniqueIndexStatements(table, rule.name, rule.columns));
      scoped.indexes.push(rule);
    }

    return scoped;
  }

  async scopeUniqueConstraint(table: string, constraint: string, columns: string[]): Promise<void> {
    await this.run(TenantIsolationSql.scopeUniqueConstraintStatement(table, constraint, columns));
  }

  async countUnassigned(table: string): Promise<number> {
    const rows = await this.run(TenantIsolationSql.unassignedCountStatement(table));
    return Number(rows?.[0]?.unassigned ?? 0);
  }

  /**
   * Counted first, then assigned. `queryRaw` hands back ROWS, not pg's `rowCount`, so an UPDATE
   * reports nothing about how much it touched — and the count is what the caller reports to the
   * operator. Both statements run on the same connection, and nothing else writes a NULL owner into
   * a table being adopted, so the count is the number assigned.
   */
  async assignUnassigned(table: string, tenantId: string): Promise<number> {
    const unassigned = await this.countUnassigned(table);
    await this.run(TenantIsolationSql.backfillStatement(table), [tenantId]);
    return unassigned;
  }

  private async runAll(statements: string[]): Promise<void> {
    for (const statement of statements) {
      await this.run(statement);
    }
  }

  /** Rows from the catalog, minus the ones whose column list came back empty. */
  private static rulesOf(rows: Array<Record<string, unknown>>): ITenantBlindUniqueRule[] {
    return (rows ?? [])
      .map((row) => ({ name: String(row?.name ?? ''), columns: PostgresTenantIsolation.columnList(row?.columns) }))
      .filter((rule) => rule.name !== '' && rule.columns.length > 0);
  }

  /** `array_agg` arrives as a JS array from pg, or as `{a,b}` text through some paths. */
  private static columnList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => String(entry));
    const text = String(value ?? '').trim();
    if (!text.startsWith('{')) return text ? [text] : [];
    return text.slice(1, -1).split(',').map((entry) => entry.replace(/^"|"$/g, '').trim()).filter(Boolean);
  }
}

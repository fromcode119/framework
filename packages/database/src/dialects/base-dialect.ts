import { DatabaseRoleOutcome } from '@database/roles/database-role-outcome';
import type { DatabaseRolePlan } from '@database/roles/database-role-plan';
import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import { RefusingTenantIsolation } from '@database/tenant/refusing-tenant-isolation';
import type { ITenantIsolation } from '@database/interfaces/tenant-isolation.interface';
import type { IColumnStats } from '@database/interfaces/column-stats.interface';
import { JoinType } from '@database/enums/join-type.enum';
import { sql, or, eq, ne, gt, gte, lt, lte, isNull, isNotNull, inArray, notInArray } from 'drizzle-orm';
import { WhereClauseParser } from '@database/dialects/where-clause-parser';
import { WhereComparison } from '@database/dialects/where-comparison';
import { NamingStrategy } from '@database/naming-strategy';
import type { DialectColumnNormalizer } from '@database/dialects/dialect-column-normalizer';
import type { IJoinClause } from '@database/interfaces/join-clause.interface';
import { OrderByBuilder } from '@database/dialects/order-by-builder';
import type { ISchemaIntrospection } from '@database/interfaces/schema-introspection.interface';
import { BlindSchemaIntrospection } from '@database/introspection/blind-schema-introspection';
import { SqlPredicateRenderer } from '@database/dialects/sql-predicate-renderer';
import { JoinedQueryBuilder } from '@database/dialects/joined-query-builder';
import { RawStatementBuilder } from '@database/dialects/raw-statement-builder';

/**
 * BaseDialect - Shared utilities for database dialect implementations
 *
 * Provides common helper methods used across Postgres, MySQL, and SQLite dialects.
 * This reduces code duplication while allowing each dialect to maintain its specific implementation.
 */
export abstract class BaseDialect {
  protected orderByBuilder = new OrderByBuilder();

  /**
   * How one comparison becomes SQL. Composed rather than inherited — `SqlPredicateRenderer` says why
   * a base class could not express this.
   *
   * Arrow closures, so a SUBCLASS override still wins: Postgres overriding `getParamPlaceholder` is
   * what runs, because `this` is resolved when the closure is called.
   */
  protected readonly predicates = new SqlPredicateRenderer({
    quoteIdentifier: (name) => this.quoteIdentifier(name),
    getParamPlaceholder: (index) => this.getParamPlaceholder(index),
    normalizeParamValue: (value) => this.normalizeParamValue(value),
    comparisonColumn: (comparison, quotedColumn) => this.comparisonColumn(comparison, quotedColumn),
    equalityColumnExpression: (quotedColumn, value) => this.equalityColumnExpression(quotedColumn, value),
    patternColumnExpression: (quotedColumn) => this.patternColumnExpression(quotedColumn),
    getLikeOperator: () => this.getLikeOperator(),
    resolveColumn: (column, tableOrName) => this.resolveColumn(column, tableOrName),
    drizzlePatternColumn: (column) => this.drizzlePatternColumn(column),
  });

  /**
   * Joined SELECTs — see {@link JoinedQueryBuilder}. Composed for the same reason predicates are,
   * and it needs only two things from this dialect.
   */
  protected readonly joinedQueries = new JoinedQueryBuilder(
    (name) => this.quoteIdentifier(name),
    (comparison, quotedColumn, values) => this.renderPredicate(comparison, quotedColumn, values),
  );

  /** Raw-text statements — see {@link RawStatementBuilder}. */
  protected readonly rawStatements = new RawStatementBuilder({
    quoteIdentifier: (name) => this.quoteIdentifier(name),
    getParamPlaceholder: (index) => this.getParamPlaceholder(index),
    getLikeOperator: () => this.getLikeOperator(),
    patternColumnExpression: (quotedColumn) => this.patternColumnExpression(quotedColumn),
    dayBucketExpression: (quotedColumn) => this.dayBucketExpression(quotedColumn),
    renderPredicate: (comparison, quotedColumn, values) => this.renderPredicate(comparison, quotedColumn, values),
  });

  /** @see RawStatementBuilder.buildGroupCountSQL */
  protected buildGroupCountSQL(...args: Parameters<RawStatementBuilder['buildGroupCountSQL']>): ReturnType<RawStatementBuilder['buildGroupCountSQL']> {
    return this.rawStatements.buildGroupCountSQL(...args);
  }

  /** @see RawStatementBuilder.buildRawFilterSQL */
  protected buildRawFilterSQL(...args: Parameters<RawStatementBuilder['buildRawFilterSQL']>): ReturnType<RawStatementBuilder['buildRawFilterSQL']> {
    return this.rawStatements.buildRawFilterSQL(...args);
  }

  /** @see JoinedQueryBuilder.buildJoinedSQL */
  protected buildJoinedSQL(...args: Parameters<JoinedQueryBuilder['buildJoinedSQL']>): ReturnType<JoinedQueryBuilder['buildJoinedSQL']> {
    return this.joinedQueries.buildJoinedSQL(...args);
  }

  /** @see JoinedQueryBuilder.processJoinedRows */
  protected processJoinedRows(rows: any[], joins: IJoinClause[]): any[] {
    return this.joinedQueries.processJoinedRows(rows, joins);
  }

  /** @see SqlPredicateRenderer.buildWhereConditions */
  protected buildWhereConditions(where: any, tableOrName?: any): any[] {
    return this.predicates.buildWhereConditions(where, tableOrName);
  }

  /** @see SqlPredicateRenderer.buildRawWhereClause */
  protected buildRawWhereClause(where: any): { sql: string; values: any[] } {
    return this.predicates.buildRawWhereClause(where);
  }

  /** @see SqlPredicateRenderer.renderPredicate */
  protected renderPredicate(comparison: WhereComparison, quotedColumn: string, values: any[]): string {
    return this.predicates.renderPredicate(comparison, quotedColumn, values);
  }

  /** @see SqlPredicateRenderer.drizzleSearchCondition */
  protected drizzleSearchCondition(search?: { columns: string[]; value: string }): any {
    return this.predicates.drizzleSearchCondition(search);
  }

  /** @see SqlPredicateRenderer.drizzlePatternCondition */
  protected drizzlePatternCondition(column: any, comparison: WhereComparison): any {
    return this.predicates.drizzlePatternCondition(column, comparison);
  }

  /**
   * Marks this connection as the PLATFORM's own — the one that runs migrations and schema sync.
   *
   * Such a connection is never serving a tenant request, and it legitimately writes deployment-level
   * rows (schema fingerprints and the like) that belong to no tenant. Default is a no-op: a driver
   * without row-level security has nothing to mark.
   */
  markAsPlatformConnection(): void {
    // no-op
  }

  /**
   * Whether this driver can actually isolate tenants. Default FALSE.
   *
   * The default is deliberately the refusing one. An earlier version of this class returned a
   * permissive passthrough, which meant any driver that did not override it — MySQL, and every
   * future driver — silently ran with NO isolation and no error: every tenant reading every other
   * tenant's rows, looking perfectly healthy. A base class must not hand out a security property
   * nobody implemented.
   */
  supportsTenantIsolation(): boolean {
    return false;
  }

  /**
   * The refusing implementation, for the same reason `supportsTenantIsolation` defaults to false: a
   * base class must not hand out a security property nobody implemented. A driver with row-level
   * security overrides this with a real one.
   */
  readonly tenantIsolation: ITenantIsolation = new RefusingTenantIsolation(this.constructor.name);

  readonly introspection: ISchemaIntrospection = new BlindSchemaIntrospection();

  /**
   * No catalog to interrogate and no way to add the constraint after the fact, so this REPORTS
   * rather than throwing — nothing is unsafe about a driver that cannot reconcile a declared unique,
   * unlike isolation, where silence would be mistaken for protection.
   */
  /**
   * Nothing, by default. Re-typing a column in place is not portable — SQLite cannot do it at all —
   * and a driver silently doing nothing is the honest answer here: the builder emits the key
   * correctly now, so only databases created by the old builder carry the broken shape.
   */
  async repairTextIdPrimaryKey(_table: string): Promise<void> {
    return undefined;
  }

  async ensureDeclaredUnique(_table: string, _column: string): Promise<SchemaReconcileOutcome> {
    return SchemaReconcileOutcome.unsupported(
      `${this.constructor.name}: this driver cannot reconcile a declared UNIQUE on an existing column.`,
    );
  }

  /**
   * No catalog to read, so nothing is claimed about the column.
   *
   * Zero rows would be a LIE that reads as "safe to drop" — the one answer that must never be
   * invented. A driver that cannot count says so by refusing.
   */
  async columnStats(_table: string, _column: string): Promise<IColumnStats> {
    throw new Error(
      `${this.constructor.name}: this driver cannot report column statistics, so there is nothing to `
      + 'show an operator deciding whether a column is safe to drop. Refusing rather than reporting zero.',
    );
  }

  /** Irreversible, so a driver without an implementation refuses rather than silently doing nothing. */
  async dropColumn(_table: string, _column: string): Promise<void> {
    throw new Error(`${this.constructor.name}: this driver cannot drop a column.`);
  }

  /** Same contract as `ensureDeclaredUnique`: a driver that cannot answer REPORTS rather than throws. */
  async ensureDeclaredNullable(_table: string, _column: string): Promise<SchemaReconcileOutcome> {
    return SchemaReconcileOutcome.unsupported(
      `${this.constructor.name}: this driver cannot relax a NOT NULL on an existing column.`,
    );
  }

  /**
   * Runs `fn` with every statement bound to `tenantId`.
   *
   * Overridden per driver by its isolation strategy — Postgres holds a pooled client with
   * `app.tenant_id` set (see TenantConnectionScope); a separate-database driver would bind that
   * tenant's connection. A driver that has not implemented one REFUSES rather than running `fn`
   * unisolated.
   *
   * This is never reached on a single-tenant deployment: TenantMode leaves tenancy off entirely, so
   * no tenant scope is opened and drivers without a strategy keep working exactly as before.
   */
  async withTenant<T>(_tenantId: string, _fn: () => Promise<T>): Promise<T> {
    throw new Error(
      `${this.constructor.name}: this driver has no tenant isolation strategy, so a tenant-scoped `
      + 'request cannot be served safely. Refusing rather than running the query unisolated.',
    );
  }

  /** No row-level security here, so there is nothing to lift: `fn` runs as is. */
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  /**
   * A driver that cannot serialise callers REFUSES, exactly as `withTenant` does.
   *
   * Running `fn` anyway would look like it worked and quietly permit the race the caller asked to be
   * protected from — and the first caller of this is first-administrator creation, where losing that
   * race means two administrators nobody intended.
   */
  async withExclusiveLock<T>(name: string, _fn: () => Promise<T>): Promise<T> {
    throw new Error(
      `${this.constructor.name}: this driver has no exclusive-lock strategy, so "${name}" cannot be `
      + 'serialised. Refusing rather than running it unprotected.',
    );
  }

  /**
   * A driver with no login system reports that, rather than throwing.
   *
   * Unlike `withExclusiveLock` above — where carrying on unprotected would permit the race the caller
   * asked to be prevented — there is nothing unsafe about a database that has no roles to create. SQLite
   * is the case: its access boundary is the database file's permissions, and it also cannot isolate
   * tenants, so a deployment that needs a least-privilege runtime role is already refused elsewhere.
   */
  async provisionRoles(_plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome> {
    return DatabaseRoleOutcome.unsupported(
      `${this.constructor.name}: this driver has no login system, so there are no roles to provision. `
      + 'Access is controlled outside the database.',
    );
  }

  /** Nothing to grant where there are no roles to grant to. */
  async grantRuntimePrivileges(_role: string): Promise<DatabaseRoleOutcome> {
    return DatabaseRoleOutcome.unsupported(
      `${this.constructor.name}: this driver has no login system, so there are no privileges to grant.`,
    );
  }

  /**
   * Normalize parameter values for database queries
   * Handles undefined, null, Date, Buffer, and objects (JSON stringify)
   */
  protected normalizeParamValue(value: any): any {
    return NamingStrategy.normalizeParamValue(value);
  }


  /**
   * The left-hand column expression for one predicate, given the caller's already-quoted column.
   *
   * Equality operators route through `equalityColumnExpression` so a dialect can align the STORED
   * precision with what the driver's read-back value can express — see the Postgres override, where a
   * microsecond timestamp read back as a millisecond JS Date could otherwise never equal itself
   * again (which broke every optimistic lock of the form `update(table, { id, updatedAt }, …)`).
   * Range operators keep the plain column: they are not an identity check, so operand precision does
   * not flip their meaning.
   */
  protected comparisonColumn(comparison: { operator: string; value: any }, quotedColumn: string): string {
    if (comparison.operator === 'eq' || comparison.operator === 'ne') {
      return this.equalityColumnExpression(quotedColumn, comparison.value);
    }
    return quotedColumn;
  }

  /** Dialect hook: the column expression used when comparing for (in)equality against `value`. */
  protected equalityColumnExpression(quotedColumn: string, _value: any): string {
    return quotedColumn;
  }





  /** The drizzle twin of {@link patternColumnExpression} — Postgres casts, everyone else does not. */
  protected drizzlePatternColumn(column: any): any {
    return column;
  }


  /**
   * Build ORDER BY clause from various formats
   * Supports: string ("created_at desc"), object ({ created_at: 'desc' }), or drizzle expressions
   */
  protected buildOrderBy(orderBy: any): any {
    return this.orderByBuilder.buildOrderBy(orderBy);
  }

  /**
   * Build raw SQL ORDER BY clause for string-based queries
   */
  protected buildRawOrderByClause(orderBy: any): string {
    return this.orderByBuilder.buildRawOrderByClause(orderBy);
  }

  /**
   * Returns the SQL LIKE operator string for this dialect.
   * Postgres overrides this to return 'ILIKE' for case-insensitive matching.
   */
  protected getLikeOperator(): string {
    return 'LIKE';
  }

  /**
   * The expression that turns a timestamp column into its `YYYY-MM-DD` day, in this dialect's SQL.
   * SQLite stores these columns as TEXT so it slices; the others format a real timestamp.
   */
  protected dayBucketExpression(quotedColumn: string): string {
    return `substr(${quotedColumn}, 1, 10)`;
  }

  /**
   * Quote one identifier for raw-SQL interpolation, rejecting anything that is not a plain identifier.
   *
   * Every raw builder below interpolates column names directly into the statement, so the name is the
   * one place a caller-supplied string reaches SQL as CODE rather than as a bound parameter. Neither
   * plain quoting nor drizzle's `sql.identifier` escapes an embedded double quote, so a name carrying
   * one would close the quoted identifier and inject. Names are canonical schema field names — always
   * plain identifiers — so anything else is rejected rather than escaped.
   */
  protected quoteIdentifier(name: string): string {
    return `"${NamingStrategy.toSafeColumnIdentifier(name)}"`;
  }

  /**
   * Resolve one canonical field name (a `where` key or a `search.columns` entry) to a column expression.
   *
   * Callers pass CANONICAL camelCase schema field names; the PHYSICAL column is snake_case. A drizzle
   * table object keys its columns by that same camelCase name, so prefer the declared property — it
   * already maps to the right physical column, and it is the only thing that gets a genuinely
   * camelCase physical column right. When the table object does not declare it — or there is no table
   * object at all — fall back to a raw identifier, snake_cased: a verbatim camelCase identifier matches
   * no column, and SQLite does not always reject it but degrades the double-quoted name to a STRING
   * LITERAL, so the predicate compares the column NAME as text (matching nothing, or every row when the
   * term is a substring of that name). Postgres/MySQL raise "column does not exist" instead.
   *
   * The fallback is shape-checked: `sql.identifier` does NOT escape an embedded double quote, so an
   * unchecked name would break out of the quoted identifier.
   */
  protected resolveColumn(column: string, tableOrName?: any): any {
    const declared = tableOrName?.[column] ?? tableOrName?.[NamingStrategy.toSnakeCase(column)];
    if (declared !== undefined && declared !== null) return declared;
    return sql`${sql.identifier(NamingStrategy.toSafeColumnIdentifier(column))}`;
  }

  /**
   * Resolve a `search` option's canonical field names to REAL columns of `tableName`, or throw.
   *
   * Every string-table read path funnels through here so an unresolvable search column can never reach
   * SQL — on SQLite it would degrade to a string literal and silently return the wrong rows. Returns
   * undefined when there is nothing to search on, so the filter builder omits the clause entirely.
   */
  protected async resolveSearchArg(
    normalizer: DialectColumnNormalizer,
    tableName: string,
    search?: { columns: string[]; value: string }
  ): Promise<{ columns: string[]; value: string } | undefined> {
    if (search === undefined || search === null) return undefined;

    // A malformed option must not be DISCARDED: dropping it silently turns a filtered request into an
    // unfiltered one, which answers a search with the entire table — the same silent-wrong-result class
    // as an unresolvable column. `search: 'term'` (a bare string instead of { columns, value }) is the
    // shape that actually shipped, so it is named explicitly here.
    if (!Array.isArray((search as any).columns) || (search as any).columns.length === 0) {
      throw new Error(
        `Invalid search option for table "${tableName}": expected { columns: string[], value: string }, ` +
        `received ${JSON.stringify(search)}. A search with no columns would return the whole table.`
      );
    }

    // An empty term is how callers express "no search"; it filters nothing by design.
    if (!search.value) return undefined;

    const columns = await normalizer.resolveColumnsForTable(tableName, search.columns);
    return { columns, value: search.value };
  }

  /**
   * Dialect hook: the column expression a pattern operator matches against.
   *
   * Base is the column itself, which is right wherever LIKE accepts any column type. Postgres does
   * not — it has no `jsonb LIKE text` operator, so searching a JSON column (a tags array, say) raises
   * instead of matching — and so overrides this with an explicit text cast.
   */
  protected patternColumnExpression(quotedColumn: string): string {
    return quotedColumn;
  }

  /**
   * Returns the SQL parameter placeholder for the given 1-based index.
   * Override in dialects that use positional placeholders ($1, $2 …).
   */
  protected getParamPlaceholder(_index: number): string {
    return '?';
  }

  /**
   * Execute a raw SELECT string against the underlying connection.
   * Must be overridden by each concrete dialect.
   */
  protected async executeRawSelect(_sql: string, _values: any[]): Promise<any[]> {
    throw new Error('executeRawSelect is not implemented for this dialect');
  }

}

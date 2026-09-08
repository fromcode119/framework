import { describe, expect, it } from 'vitest';
import { TenantRlsSql } from '@database/tenant/tenant-rls-sql';

describe('TenantRlsSql', () => {
  it('guards the predicate with nullif so an empty setting never matches', () => {
    expect(TenantRlsSql.predicate())
      .toBe("tenant_id = nullif(current_setting('app.tenant_id', true), '')");
  });

  it('never emits a bare current_setting comparison', () => {
    const all = TenantRlsSql.statementsFor('pages').join('\n');
    expect(all).toContain('nullif(');
    expect(all).not.toMatch(/=\s*current_setting\('app\.tenant_id',\s*true\)\s*\)/);
  });

  it('emits column, index, enable, force and policy for a table', () => {
    const stmts = TenantRlsSql.statementsFor('pages');
    expect(stmts[0]).toBe(
      'ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT '
      + "DEFAULT nullif(current_setting('app.tenant_id', true), '')",
    );
    expect(stmts[1]).toBe('CREATE INDEX IF NOT EXISTS "pages_tenant_id_idx" ON "pages" ("tenant_id")');
    expect(stmts[2]).toBe('ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY');
    expect(stmts[3]).toBe('ALTER TABLE "pages" FORCE ROW LEVEL SECURITY');
    expect(stmts[4]).toBe('DROP POLICY IF EXISTS "pages_tenant_isolation" ON "pages"');
    expect(stmts[5]).toBe(
      'CREATE POLICY "pages_tenant_isolation" ON "pages" '
      + `USING (${TenantRlsSql.predicate()}) WITH CHECK (${TenantRlsSql.predicate()})`,
    );
  });

  it('always includes FORCE — without it the table owner reads every tenant', () => {
    expect(TenantRlsSql.statementsFor('orders')).toContain('ALTER TABLE "orders" FORCE ROW LEVEL SECURITY');
  });

  it('sets and clears the tenant setting at session scope', () => {
    expect(TenantRlsSql.setTenantStatement()).toBe("SELECT set_config('app.tenant_id', $1, false)");
    expect(TenantRlsSql.resetTenantStatement()).toBe("SELECT set_config('app.tenant_id', '', false)");
  });

  it('rejects a table name that is not a plain identifier', () => {
    expect(() => TenantRlsSql.statementsFor('pages"; DROP TABLE users; --')).toThrow(/identifier/i);
  });

  it('adds the column NULLABLE — a NOT NULL default that evaluates to NULL cannot be added to a populated table', () => {
    expect(TenantRlsSql.statementsFor('pages')[0]).not.toContain('NOT NULL');
  });

  it('offers a parameterised backfill rather than inventing an owner for pre-tenancy rows', () => {
    expect(TenantRlsSql.backfillStatement('pages'))
      .toBe('UPDATE "pages" SET "tenant_id" = $1 WHERE "tenant_id" IS NULL');
  });

  it('can count rows that predate tenancy and are invisible to every tenant', () => {
    expect(TenantRlsSql.unassignedCountStatement('pages'))
      .toBe('SELECT count(*)::int AS unassigned FROM "pages" WHERE "tenant_id" IS NULL');
  });
});

describe('TenantRlsSql — taking a tenant-less deployment back out of isolation', () => {
  it('drops every named policy, then FORCE, then RLS — in that order', () => {
    const statements = TenantRlsSql.removalStatementsFor('media', ['media_tenant_select', 'media_tenant_delete']);
    expect(statements).toEqual([
      'DROP POLICY IF EXISTS "media_tenant_select" ON "media"',
      'DROP POLICY IF EXISTS "media_tenant_delete" ON "media"',
      'ALTER TABLE "media" NO FORCE ROW LEVEL SECURITY',
      'ALTER TABLE "media" DISABLE ROW LEVEL SECURITY',
    ]);
  });

  it('never drops the tenant_id column — repairing an installation must not lose ownership', () => {
    const statements = TenantRlsSql.removalStatementsFor('pages', ['pages_tenant_isolation']).join(' ');
    expect(statements).not.toContain('DROP COLUMN');
    expect(statements).not.toContain('tenant_id');
  });

  it('refuses an injected table or policy name', () => {
    expect(() => TenantRlsSql.removalStatementsFor('pages"; DROP TABLE users; --', [])).toThrow();
    expect(() => TenantRlsSql.removalStatementsFor('pages', ['p"; DROP TABLE users; --'])).toThrow();
  });

  it('finds bespoke policies too, not only the generic *_tenant_isolation name', () => {
    // `media` carries four per-command policies; matching only the generic suffix would have left
    // it isolated, and therefore empty, on a deployment with no tenants.
    const statement = TenantRlsSql.isolatedPoliciesStatement();
    expect(statement).toContain('pg_policies');
    expect(statement).toContain("'%\\_tenant\\_%'");
    expect(statement).not.toContain('_tenant_isolation');
  });

  it('rewrites a tenant-blind UNIQUE constraint as (cols…, tenant_id), keeping default NULL semantics', () => {
    expect(TenantRlsSql.scopeUniqueConstraintStatement('fcp_zeta_pages', 'fcp_zeta_pages_slug_key', ['slug']))
      .toBe('ALTER TABLE "fcp_zeta_pages" DROP CONSTRAINT "fcp_zeta_pages_slug_key", ADD CONSTRAINT "fcp_zeta_pages_slug_key" UNIQUE ("slug", "tenant_id")');
    expect(TenantRlsSql.scopeUniqueIndexStatements('fcp_eta_meta', 'idx_fcp_eta_meta_content_unique', ['content_type', 'content_id'])).toEqual([
      'DROP INDEX IF EXISTS "idx_fcp_eta_meta_content_unique"',
      'CREATE UNIQUE INDEX "idx_fcp_eta_meta_content_unique" ON "fcp_eta_meta" ("content_type", "content_id", "tenant_id")',
    ]);
  });

  it('finds tenant-blind uniques by catalog, never by a hand-kept list, and skips what a FOREIGN KEY depends on', () => {
    const constraints = TenantRlsSql.tenantBlindUniqueConstraintsStatement();
    expect(constraints).toContain("c.contype = 'u'");
    expect(constraints).toContain("f.contype = 'f' AND f.conindid = c.conindid");
    expect(constraints).toContain('$2');
    expect(TenantRlsSql.tenantBlindUniqueIndexesStatement()).toContain('NOT x.indisprimary');
  });

  it('refuses an injected constraint or column name in the rewrite', () => {
    expect(() => TenantRlsSql.scopeUniqueConstraintStatement('pages', 'x"; DROP TABLE pages; --', ['slug'])).toThrow();
    expect(() => TenantRlsSql.scopeUniqueIndexStatements('pages', 'idx', ['slug"; --'])).toThrow();
  });
});

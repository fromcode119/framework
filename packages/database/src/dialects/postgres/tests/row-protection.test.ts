import { describe, expect, it } from 'vitest';
import { PostgresRowProtection } from '@database/dialects/postgres/protection/postgres-row-protection';
import { RowProtectionSql } from '@database/dialects/postgres/protection/row-protection-sql';

describe('Postgres row protection', () => {
  it('installs the trigger function once, then a row trigger and a truncate trigger per table', async () => {
    const statements: string[] = [];
    const protection = new PostgresRowProtection(async (text) => { statements.push(text); return []; });
    await protection.protect('fcp_finance_sale_documents', ['document_number', 'issued_pdf'], true);
    await protection.protect('fcp_finance_sale_document_numbers', ['number'], true);
    expect(statements.filter((s) => s.startsWith('CREATE OR REPLACE FUNCTION fc_protect_written_rows'))).toHaveLength(1);
    expect(statements).toContain(`CREATE TRIGGER "fcp_finance_sale_documents_protect_rows" BEFORE UPDATE OR DELETE ON "fcp_finance_sale_documents" FOR EACH ROW EXECUTE FUNCTION fc_protect_written_rows('no_delete', 'document_number', 'issued_pdf')`);
    expect(statements).toContain(`CREATE TRIGGER "fcp_finance_sale_documents_protect_truncate" BEFORE TRUNCATE ON "fcp_finance_sale_documents" FOR EACH STATEMENT EXECUTE FUNCTION fc_protect_written_rows('no_delete')`);
  });

  it('allows deletes and adds no truncate trigger when only columns are write-once', () => {
    const statements = RowProtectionSql.triggerStatements('fcp_x', ['a'], false);
    expect(statements.join('\n')).toContain(`fc_protect_written_rows('allow_delete', 'a')`);
    expect(statements.some((s) => s.includes('BEFORE TRUNCATE'))).toBe(false);
  });

  it('refuses identifiers that are not plain names', () => {
    expect(() => RowProtectionSql.triggerStatements('fcp_x"; DROP', ['a'], true)).toThrow(/unexpected identifier/);
    expect(() => RowProtectionSql.triggerStatements('fcp_x', ["a'); --"], true)).toThrow(/unexpected column/);
  });

  it('allows the current transaction past the protection only when asked', async () => {
    const statements: string[] = [];
    await new PostgresRowProtection(async (text) => { statements.push(text); return []; }).allowWithinTransaction();
    expect(statements).toEqual(["SET LOCAL fromcode.protected_rows_override = 'on'"]);
  });

  it('lets only the transaction-local override through', () => {
    expect(RowProtectionSql.overrideStatement()).toBe("SET LOCAL fromcode.protected_rows_override = 'on'");
    expect(RowProtectionSql.functionStatement()).toContain("current_setting('fromcode.protected_rows_override', true) = 'on'");
  });

  it('honours the override only for the role that owns the table, not for whoever sets the flag', () => {
    expect(RowProtectionSql.functionStatement()).toContain("AND pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = TG_RELID), 'USAGE') THEN");
  });
});

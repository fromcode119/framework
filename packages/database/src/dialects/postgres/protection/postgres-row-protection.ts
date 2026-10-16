import type { IRowProtection } from '@database/interfaces/row-protection.interface';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';
import { RowProtectionSql } from '@database/dialects/postgres/protection/row-protection-sql';

/** Row protection as Postgres implements it: a trigger on each protected table (see RowProtectionSql). */
export class PostgresRowProtection implements IRowProtection {
  private installed: Promise<void> | null = null;

  constructor(private readonly run: ISqlRunner) {}

  async protect(table: string, writeOnceColumns: string[], noDelete: boolean): Promise<void> {
    this.installed ??= this.run(RowProtectionSql.functionStatement()).then(() => undefined).catch((error) => { this.installed = null; throw error; });
    await this.installed;
    for (const statement of RowProtectionSql.triggerStatements(table, writeOnceColumns, noDelete)) await this.run(statement);
  }

  async allowWithinTransaction(): Promise<void> {
    await this.run(RowProtectionSql.overrideStatement());
  }
}

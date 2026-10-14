import { SqlIdentifier } from '@database/dialects/postgres/sql-identifier';

/**
 * What a renamed Postgres table still carries under its old name.
 *
 * `ALTER TABLE … RENAME` moves the rows, and every index, sequence, constraint and row-level policy stays
 * attached — but each keeps the name it was created with. The tenant-isolation sweep recreates a policy
 * as `"<table>_tenant_isolation"` and the schema builder creates indexes by name `IF NOT EXISTS`, so under
 * the new table name both would add a second copy beside the old one. Renaming every object whose name
 * starts with the old table name to the same suffix under the new one keeps a single set.
 */
export class PostgresTableRename {
  static async renameDependents(db: { queryRaw(sql: string, values?: unknown[]): Promise<Array<Record<string, unknown>>> }, from: string, to: string): Promise<void> {
    const oldName = SqlIdentifier.assert(from, 'PostgresTableRename');
    const newName = SqlIdentifier.assert(to, 'PostgresTableRename');
    const renamed = (name: string) => SqlIdentifier.assert(newName + name.slice(oldName.length), 'PostgresTableRename');
    const owned = (rows: Array<Record<string, unknown>>) => rows.map((row) => String(row.name)).filter((name) => name.startsWith(oldName));

    for (const name of owned(await db.queryRaw(
      `SELECT c.conname AS name FROM pg_constraint c WHERE c.conrelid = $1::regclass`, [newName],
    ))) {
      await db.queryRaw(`ALTER TABLE "${newName}" RENAME CONSTRAINT "${name}" TO "${renamed(name)}"`);
    }
    // After the constraints: a primary or unique key's index carries the constraint's name and was renamed with it.
    for (const name of owned(await db.queryRaw(
      `SELECT i.relname AS name FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid WHERE x.indrelid = $1::regclass`, [newName],
    ))) {
      await db.queryRaw(`ALTER INDEX "${name}" RENAME TO "${renamed(name)}"`);
    }
    for (const name of owned(await db.queryRaw(
      `SELECT s.relname AS name FROM pg_depend d JOIN pg_class s ON s.oid = d.objid
        WHERE d.refobjid = $1::regclass AND d.classid = 'pg_class'::regclass AND s.relkind = 'S'`, [newName],
    ))) {
      await db.queryRaw(`ALTER SEQUENCE "${name}" RENAME TO "${renamed(name)}"`);
    }
    for (const name of owned(await db.queryRaw(
      `SELECT p.polname AS name FROM pg_policy p WHERE p.polrelid = $1::regclass`, [newName],
    ))) {
      await db.queryRaw(`ALTER POLICY "${name}" ON "${newName}" RENAME TO "${renamed(name)}"`);
    }
  }
}

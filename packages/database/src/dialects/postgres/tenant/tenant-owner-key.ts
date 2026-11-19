import { SqlIdentifier } from '@database/dialects/postgres/sql-identifier';
import { TenantColumn } from '@database/tenant/tenant-column';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';

/**
 * Takes the site out of a table's KEY, for a deployment that has no sites.
 *
 * A site-owned table is keyed on (tenant_id, id) so an imported site can keep its own ids. That key
 * makes the ownership column a key column, and a key column cannot be null — but on a deployment with
 * no tenants there is no site for a row to name. Tables that were EMPTY when the key was widened took
 * it (a fresh single-site installation), and from then on nothing could be written to them: a file
 * upload answered `null value in column "tenant_id" of relation "media"`, and so did the signed-in
 * user's own person record on every console load. An installation that already held rows kept its old
 * key, which is why the same release worked there.
 *
 * So with no tenants the key goes back to the row's own id and the column stops being required. The
 * references that pointed at the wide key are rebuilt on the narrow one, with the delete and update
 * behaviour they had — read from the catalog, because dropping it turns "deleting a person removes
 * their addresses" into a refusal.
 *
 * ONE WAY, deliberately. Nothing widens the key again when a tenant appears: a table keyed on its own
 * id is a state every release already supports (an installation whose tables held rows when the key
 * was introduced has it today) — a site imported into it gets new ids instead of keeping its own. What
 * keeps one site from reading another is row-level security, which the sweep re-applies the moment a
 * tenant exists; the key is not part of that.
 */
export class PostgresTenantOwnerKey {
  private static readonly BY = 'PostgresTenantOwnerKey';
  private static readonly ACTIONS: Record<string, string> = { r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

  constructor(private readonly run: ISqlRunner) {}

  /** Returns whether the table changed. A table without the ownership column is left alone. */
  async release(table: string): Promise<boolean> {
    const name = SqlIdentifier.assert(table, PostgresTenantOwnerKey.BY);
    const key = await this.primaryKey(name);
    const owned = key?.columns.includes(TenantColumn.NAME) ?? false;
    if (!owned && !(await this.ownerRequired(name))) return false;
    // Rows of more than one site (sites removed, their rows left behind) are several customers' data:
    // that table keeps the key that tells them apart, exactly as its isolation is kept.
    if (await this.holdsSeveralSites(name)) return false;

    const references = owned ? await this.referencesTo(name) : [];
    for (const reference of references) {
      await this.run(`ALTER TABLE "${reference.child}" DROP CONSTRAINT "${reference.name}"`);
    }

    try {
      // ONE statement: the table comes out with its new key or keeps exactly the one it had.
      const rekey = owned && key
        ? `DROP CONSTRAINT "${key.name}", ADD PRIMARY KEY (${PostgresTenantOwnerKey.withoutOwner(key.columns).map((column) => `"${column}"`).join(', ')}), `
        : '';
      await this.run(`ALTER TABLE "${name}" ${rekey}ALTER COLUMN "${TenantColumn.NAME}" DROP NOT NULL`);
    } catch (error) {
      // The key is unchanged, so the references go back exactly as they were.
      for (const reference of references) {
        await this.run(`ALTER TABLE "${reference.child}" ADD CONSTRAINT "${reference.name}" ${reference.definition}`);
      }
      throw error;
    }

    for (const reference of references) {
      await this.run(
        `ALTER TABLE "${reference.child}" ADD CONSTRAINT "${reference.name}" `
        + `FOREIGN KEY (${reference.childColumns}) REFERENCES "${name}" (${reference.parentColumns})${reference.actions}`,
      );
    }
    return true;
  }

  private static withoutOwner(columns: string[]): string[] {
    return columns.filter((column) => column !== TenantColumn.NAME);
  }

  private async primaryKey(table: string): Promise<{ name: string; columns: string[] } | null> {
    const rows = await this.run(
      `SELECT c.conname AS name, a.attname AS column_name
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, position) ON TRUE
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        WHERE c.contype = 'p' AND n.nspname = 'public' AND t.relname = $1
        ORDER BY k.position`,
      [table],
    );
    if (!rows?.length) return null;
    const columns = rows.map((row: any) => SqlIdentifier.assert(String(row.column_name), PostgresTenantOwnerKey.BY));
    // A key that is ONLY the ownership column has no id to fall back to; it is left as it is.
    if (PostgresTenantOwnerKey.withoutOwner(columns).length === 0) return null;
    return { name: SqlIdentifier.assert(String(rows[0].name), PostgresTenantOwnerKey.BY), columns };
  }

  private async holdsSeveralSites(table: string): Promise<boolean> {
    const rows = await this.run(
      `SELECT COUNT(*) AS owners FROM (SELECT DISTINCT "${TenantColumn.NAME}" FROM "${table}" `
      + `WHERE "${TenantColumn.NAME}" IS NOT NULL LIMIT 2) AS sites`,
    );
    return Number(rows?.[0]?.owners ?? 0) > 1;
  }

  private async ownerRequired(table: string): Promise<boolean> {
    const rows = await this.run(
      `SELECT a.attnotnull AS required FROM pg_attribute a
         JOIN pg_class t ON t.oid = a.attrelid JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = $1 AND a.attname = $2 AND a.attnum > 0`,
      [table, TenantColumn.NAME],
    );
    const required = rows?.[0]?.required;
    return required === true || required === 't';
  }

  /** Every reference that points at this table's key THROUGH the ownership column. */
  private async referencesTo(table: string): Promise<Array<{ name: string; child: string; definition: string; childColumns: string; parentColumns: string; actions: string }>> {
    const rows = await this.run(
      `SELECT c.conname AS name, child.relname AS child, pg_get_constraintdef(c.oid) AS definition,
              c.confdeltype::text AS del, c.confupdtype::text AS upd,
              (SELECT string_agg(a.attname, ',' ORDER BY k.position)
                 FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, position)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS child_columns,
              (SELECT string_agg(a.attname, ',' ORDER BY k.position)
                 FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, position)
                 JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) AS parent_columns
         FROM pg_constraint c
         JOIN pg_class parent ON parent.oid = c.confrelid
         JOIN pg_namespace n ON n.oid = parent.relnamespace
         JOIN pg_class child ON child.oid = c.conrelid
        WHERE c.contype = 'f' AND n.nspname = 'public' AND parent.relname = $1`,
      [table],
    );

    return (rows ?? [])
      .map((row: any) => ({ row, parent: String(row.parent_columns).split(','), child: String(row.child_columns).split(',') }))
      .filter(({ parent }) => parent.includes(TenantColumn.NAME))
      .map(({ row, parent, child }) => {
        // The two lists are positional: dropping the ownership column from the parent's drops the
        // column paired with it from the child's.
        const kept = parent.map((column, index) => ({ column, pair: child[index] })).filter(({ column }) => column !== TenantColumn.NAME);
        const quote = (columns: string[]) => columns.map((column) => `"${SqlIdentifier.assert(column, PostgresTenantOwnerKey.BY)}"`).join(', ');
        const words = PostgresTenantOwnerKey.ACTIONS;
        return {
          name: SqlIdentifier.assert(String(row.name), PostgresTenantOwnerKey.BY),
          child: SqlIdentifier.assert(String(row.child), PostgresTenantOwnerKey.BY),
          definition: String(row.definition),
          childColumns: quote(kept.map(({ pair }) => pair)),
          parentColumns: quote(kept.map(({ column }) => column)),
          actions: (words[String(row.del)] ? ` ON DELETE ${words[String(row.del)]}` : '') + (words[String(row.upd)] ? ` ON UPDATE ${words[String(row.upd)]}` : ''),
        };
      });
  }
}

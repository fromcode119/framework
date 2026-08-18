import { SortDirection } from '@database/enums/sort-direction.enum';
import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import { TableResolver } from '@database/table-resolver';

/**
 * Abstract base class for plugin migrations.
 *
 * Extend this class to define a versioned, named migration that operates on the
 * database via {@link IDatabaseManager}. Concrete migrations must implement
 * `version`, `name`, and `up`; a default no-op `down` is provided.
 *
 * Duck-typing compatibility with `SystemMigration`:
 *   MigrationManager calls `migration.up(db, sql)` — the extra `sql` argument is
 *   harmlessly ignored by JavaScript when the declared signature only lists `db`.
 *
 * @example
 * ```typescript
 * export default class AddTagsTable extends BaseMigration {
 *   readonly version = 1;
 *   readonly name    = 'add_tags_table';
 *
 *   async up(db: IDatabaseManager): Promise<void> {
 *     // Never declare an `id` field — the builder emits the primary key itself, and a declared
 *     // one used to suppress it and leave a nullable, keyless TEXT column behind.
 *     await this.createTableIfMissing(db, {
 *       slug: '@myplugin/tags',
 *       fields: [{ name: 'label', type: 'text' }],
 *     });
 *     await this.createIndexIfMissing(db, '@myplugin/tags', 'idx_tags_label', ['label']);
 *   }
 * }
 * ```
 */
export abstract class BaseMigration {
  private static readonly IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

  /**
   * Gate an identifier that is about to be interpolated into SQL.
   *
   * The value comes from a PLUGIN's migration, i.e. untrusted input at a SQL boundary — this is a
   * validation gate, not a defensive check against a framework contract. `instanceof`/`typeof` would
   * not do: `IDENTIFIER_PATTERN.test(null)` coerces to the string `'null'`, which MATCHES the pattern,
   * so a non-string must be rejected before the regex runs.
   */
  protected static assertSafeIdentifier(value: string, kind: string): string {
    const isString = Object.prototype.toString.call(value) === '[object String]';
    if (!isString || !BaseMigration.IDENTIFIER_PATTERN.test(value)) {
      throw new Error(`Refusing unsafe SQL identifier for ${kind}: ${String(value)}`);
    }
    return value;
  }

  /** Monotonically increasing integer that determines execution order. */
  abstract readonly version: number;

  /** Human-readable identifier logged during migration runs. */
  abstract readonly name: string;

  /**
   * Apply this migration.
   *
   * @param db - The database manager instance provided by the migration runner.
   *             Methods that accept table names support both the `@plugin/table`
   *             shorthand and physical table names, depending on proxy coverage.
   */
  abstract up(db: IDatabaseManager): Promise<void>;

  /**
   * Revert this migration.
   *
   * The default implementation is a no-op. Override to provide rollback logic.
   *
   * @param _db - The database manager instance (unused by default).
   */
  async down(_db: IDatabaseManager): Promise<void> {}

  /**
   * Build a semantic collection reference from owner plugin + collection slugs.
   *
   * Use this in cross-plugin migrations instead of hardcoding `@plugin/table`
   * literals inline. The migration still targets a collection by owner slug, but
   * the construction stays consistent and centralised at the framework layer.
   *
   * @param pluginSlug     - Owner plugin slug.
   * @param collectionSlug - Collection slug within the owner plugin, e.g. `pages`.
   */
  protected collectionRef(pluginSlug: string, collectionSlug: string): string {
    return `@${pluginSlug}/${collectionSlug}`;
  }

  /**
   * Add a column to `tableName` only when the column does not already exist.
   *
   * Comparison is case-insensitive so that a column named `MyField` matches an
   * existing column reported as `myfield` by the underlying driver.
   *
   * @param db        - The database manager instance.
   * @param tableName - Physical table name or `@plugin/table` shorthand.
   * @param field     - Schema field descriptor for the column to add.
   */
  protected async addColumnIfMissing(
    db: IDatabaseManager,
    tableName: string,
    field: ISchemaField,
  ): Promise<void> {
    const cols = await db.getColumns(tableName);
    if (!cols.map((c) => c.toLowerCase()).includes(field.name.toLowerCase())) {
      await db.addColumn(tableName, field);
    }
  }

  /**
   * Create a table only when it does not already exist.
   *
   * The `collection.slug` is explicitly resolved through {@link TableResolver}
   * before the existence check and table creation so that `@plugin/table`
   * shorthand is correctly expanded to its physical name regardless of whether
   * `createTable` is covered by the proxy.
   *
   * @param db         - The database manager instance.
   * @param collection - Schema collection descriptor. `slug` may be in
   *                     `@plugin/table` format or already a physical name.
   */
  protected async createTableIfMissing(
    db: IDatabaseManager,
    collection: ISchemaCollection,
  ): Promise<void> {
    const resolvedSlug = TableResolver.resolve(collection.slug);
    if (!(await db.tableExists(resolvedSlug))) {
      await db.createTable({ ...collection, slug: resolvedSlug });
    }
  }

  /**
   * Create a (optionally unique) index only when it does not already exist.
   *
   * Uses `CREATE [UNIQUE] INDEX IF NOT EXISTS` which is supported by all
   * target database drivers (SQLite, PostgreSQL, MySQL).
   *
   * Each column may be a plain string (`'col'`) or an object specifying
   * sort order (`{ name: 'col', order: 'DESC' }`). Mixed forms are allowed.
   *
   * @param db        - The database manager instance.
   * @param tableName - Physical table name or `@plugin/table` shorthand.
   * @param indexName - The index name (without quotes). Must be unique across the schema.
   * @param columns   - Ordered list of columns. Each entry is either a column name
   *                    string or `{ name, order? }` for explicit ASC/DESC ordering.
   * @param options   - Optional flags. Set `unique: true` for a unique index.
   */
  protected async createIndexIfMissing(
    db: IDatabaseManager,
    tableName: string,
    indexName: string,
    columns: Array<string | { name: string; order?: SortDirection }>,
    options?: { unique?: boolean },
  ): Promise<void> {
    const table = BaseMigration.assertSafeIdentifier(TableResolver.resolve(tableName), 'table');
    BaseMigration.assertSafeIdentifier(indexName, 'index');
    const unique = options?.unique ? 'UNIQUE ' : '';
    const cols = columns
      .map((c) => {
        if (typeof c === 'string') return `"${BaseMigration.assertSafeIdentifier(c, 'column')}"`;
        const colName = BaseMigration.assertSafeIdentifier(c.name, 'column');
        return c.order === SortDirection.ASC || c.order === SortDirection.DESC ? `"${colName}" ${c.order}` : `"${colName}"`;
      })
      .join(', ');
    await db.execute(
      `CREATE ${unique}INDEX IF NOT EXISTS "${indexName}" ON "${table}" (${cols})`,
    );
  }

  /**
   * Drop a table if it exists.
   *
   * Uses `DROP TABLE IF EXISTS` which is supported by all target database
   * drivers. Intended for use in `down()` rollback methods.
   *
   * @param db        - The database manager instance.
   * @param tableName - Physical table name or `@plugin/table` shorthand.
   */
  protected async dropTableIfExists(
    db: IDatabaseManager,
    tableName: string,
  ): Promise<void> {
    const table = BaseMigration.assertSafeIdentifier(TableResolver.resolve(tableName), 'table');
    await db.execute(`DROP TABLE IF EXISTS "${table}"`);
  }

  /**
   * Give `tableName` the sequence-backed integer primary key the schema builder should have emitted.
   *
   * Repairs a table created while a declared `{ name: 'id', type: 'id' }` field suppressed the
   * builder's own key column (see {@link SchemaKeyField}) — leaving `id` as a nullable, keyless
   * TEXT column. Inserts against that shape succeed and store NULL, so every later
   * `update(table, { id }, …)` matches nothing and the write is silently discarded.
   *
   * Two independently guarded steps, so this is safe to run repeatedly, safe on a table that was
   * never broken, and able to finish a half-applied run:
   *   1. re-key — fires only while `id` is still a character type. `USING nextval(...)` ignores the
   *      old value rather than parsing it, so NULLs and unparseable text alike get a fresh key;
   *   2. add the primary key — fires only when the table has none and `id` is already integer.
   * Each step is one self-guarding `DO` block so the decision and the DDL are a single atomic
   * statement and the guard does not depend on the driver's result shape.
   *
   * **Postgres only** — SQLite cannot ALTER a column type in place; the call no-ops on every other
   * dialect. A SQLite database carrying the broken shape has to be re-created, which is harmless
   * because the builder now emits the key correctly on both dialects.
   *
   * **Check for referencing rows before calling.** Re-keying assigns fresh values, so anything that
   * stored one of the old ids elsewhere will be orphaned. A foreign key would block the ALTER; an
   * id copied into a JSON blob or another plugin's column would not.
   *
   * @param db        - The database manager instance.
   * @param tableName - Physical table name or `@plugin/table` shorthand.
   */
  protected async repairTextIdPrimaryKey(
    db: IDatabaseManager,
    tableName: string,
  ): Promise<void> {
    if (db.dialect !== 'postgres') {
      return;
    }

    const table = BaseMigration.assertSafeIdentifier(TableResolver.resolve(tableName), 'table');
    if (!(await db.tableExists(table))) {
      return;
    }

    const sequence = BaseMigration.assertSafeIdentifier(`${table}_id_seq`, 'sequence');

    await db.execute(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = '${table}'
            AND column_name = 'id'
            AND data_type IN ('text', 'character varying', 'character')
        ) THEN
          CREATE SEQUENCE IF NOT EXISTS "${sequence}";
          ALTER TABLE "${table}" ALTER COLUMN "id" DROP DEFAULT;
          ALTER TABLE "${table}" ALTER COLUMN "id" TYPE integer USING nextval('"${sequence}"');
          ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT nextval('"${sequence}"');
          ALTER TABLE "${table}" ALTER COLUMN "id" SET NOT NULL;
          ALTER SEQUENCE "${sequence}" OWNED BY "${table}"."id";
          PERFORM setval('"${sequence}"', COALESCE((SELECT MAX("id") FROM "${table}"), 0) + 1, false);
        END IF;
      END
      $$;
    `);

    await db.execute(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = '"${table}"'::regclass AND contype = 'p'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = '${table}'
            AND column_name = 'id'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE "${table}" ADD PRIMARY KEY ("id");
        END IF;
      END
      $$;
    `);
  }

  /**
   * Drop a column from a table if it exists.
   *
   * Uses `ALTER TABLE … DROP COLUMN IF EXISTS` which is supported by
   * SQLite 3.35+, PostgreSQL, and MySQL 8.0+. Falls back to a plain
   * `DROP COLUMN` on older engines, swallowing the error if the column
   * is already absent.
   *
   * @param db        - The database manager instance.
   * @param tableName - Physical table name or `@plugin/table` shorthand.
   * @param column    - The column name to drop.
   */
  protected async dropColumnIfExists(
    db: IDatabaseManager,
    tableName: string,
    column: string,
  ): Promise<void> {
    const table = BaseMigration.assertSafeIdentifier(TableResolver.resolve(tableName), 'table');
    const safeColumn = BaseMigration.assertSafeIdentifier(column, 'column');
    try {
      await db.execute(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${safeColumn}"`);
    } catch {
      try {
        await db.execute(`ALTER TABLE "${table}" DROP COLUMN "${safeColumn}"`);
      } catch {
        // Column does not exist — nothing to drop.
      }
    }
  }
}

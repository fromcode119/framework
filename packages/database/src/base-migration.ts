import type { IDatabaseManager, ISchemaField, ISchemaCollection } from './types';
import { TableResolver } from './table-resolver';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeIdentifier(value: string, kind: string): string {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Refusing unsafe SQL identifier for ${kind}: ${String(value)}`);
  }
  return value;
}

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
 *     await this.createTableIfMissing(db, {
 *       slug: '@myplugin/tags',
 *       fields: [{ name: 'id', type: 'id' }, { name: 'label', type: 'text' }],
 *     });
 *     await this.createIndexIfMissing(db, '@myplugin/tags', 'idx_tags_label', ['label']);
 *   }
 * }
 * ```
 */
export abstract class BaseMigration {
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
   * @param pluginSlug     - Owner plugin slug, e.g. `cms`.
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
    columns: Array<string | { name: string; order?: 'ASC' | 'DESC' }>,
    options?: { unique?: boolean },
  ): Promise<void> {
    const table = assertSafeIdentifier(TableResolver.resolve(tableName), 'table');
    assertSafeIdentifier(indexName, 'index');
    const unique = options?.unique ? 'UNIQUE ' : '';
    const cols = columns
      .map((c) => {
        if (typeof c === 'string') return `"${assertSafeIdentifier(c, 'column')}"`;
        const colName = assertSafeIdentifier(c.name, 'column');
        return c.order === 'ASC' || c.order === 'DESC' ? `"${colName}" ${c.order}` : `"${colName}"`;
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
    const table = assertSafeIdentifier(TableResolver.resolve(tableName), 'table');
    await db.execute(`DROP TABLE IF EXISTS "${table}"`);
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
    const table = assertSafeIdentifier(TableResolver.resolve(tableName), 'table');
    const safeColumn = assertSafeIdentifier(column, 'column');
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

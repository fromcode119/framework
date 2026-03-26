import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';

class AddThemeNameColumn extends BaseMigration {
  readonly version = 6;
  readonly name = 'Add name and version columns to _system_themes';

  async up(db: IDatabaseManager): Promise<void> {
    const tableName = '_system_themes';
    
    try {
      const existingColumns = await db.getColumns(tableName);
      
      const columnsToAdd = [
        { name: 'name', type: 'TEXT' },
        { name: 'version', type: 'TEXT' },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
      ];

      for (const col of columnsToAdd) {
        if (!existingColumns.includes(col.name)) {
          await db.execute(sql`ALTER TABLE "${sql.raw(tableName)}" ADD COLUMN "${sql.raw(col.name)}" ${sql.raw(col.type)}`);
        }
      }
    } catch (e) {
      console.warn(`[Migration 006] Warning while adding columns to ${tableName}:`, (e as Error).message);
    }
  }

  async down(db: IDatabaseManager): Promise<void> {
    // Dropping columns is restricted in some SQLite versions, typically we don't down migrations for simple additions
  }
}

export default new AddThemeNameColumn();

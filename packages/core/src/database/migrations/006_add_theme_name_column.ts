import { BaseMigration, IDatabaseManager } from '@fromcode119/database';

class AddThemeNameColumn extends BaseMigration {
  readonly version = 6;
  readonly name = 'Add name and version columns to _system_themes';

  async up(db: IDatabaseManager): Promise<void> {
    const tableName = '_system_themes';

    await this.addColumnIfMissing(db, tableName, { name: 'name', type: 'text' });
    await this.addColumnIfMissing(db, tableName, { name: 'version', type: 'text' });
    await this.addColumnIfMissing(db, tableName, { name: 'created_at', type: 'date' });
  }

  async down(_db: IDatabaseManager): Promise<void> {}
}

export default new AddThemeNameColumn();

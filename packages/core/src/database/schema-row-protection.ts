import type { IDatabaseManager } from '@fromcode119/database';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import { NamingStrategy } from '@fromcode119/database';

/** Applies a collection's declared `protect` to its table when the driver can enforce it (Postgres). */
export class SchemaRowProtection {
  static async apply(db: IDatabaseManager, table: string, collection: ICollection, logger: { warn: (message: string) => void }): Promise<void> {
    const protect = collection.protect;
    if (!protect || (!protect.writeOnce?.length && !protect.noDelete)) return;
    if (!db.supportsRowProtection()) {
      logger.warn(`${table} declares protected rows, but the ${db.dialect} driver cannot enforce them; only the application's own rules apply.`);
      return;
    }
    const declared = new Set((collection.fields || []).map((field) => String(field.name)));
    const unknown = (protect.writeOnce || []).filter((name) => !declared.has(name));
    if (unknown.length) throw new Error(`${table} protects fields it does not declare: ${unknown.join(', ')}`);
    const columns = (protect.writeOnce || []).map((name) => NamingStrategy.toSafeColumnIdentifier(name));
    await db.rowProtection.protect(table, columns, protect.noDelete === true);
  }
}

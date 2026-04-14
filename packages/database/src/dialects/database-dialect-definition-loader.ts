import type { DatabaseDialectDefinition } from './database-dialect-definition.interfaces';
import { BuiltInDatabaseDialectDefinitions } from './built-in-database-dialect-definitions';

export class DatabaseDialectDefinitionLoader {
  private static cache: DatabaseDialectDefinition[] | null = null;

  static load(): DatabaseDialectDefinition[] {
    if (this.cache) {
      return this.cache;
    }

    if (typeof window !== 'undefined') {
      this.cache = [];
      return this.cache;
    }

    this.cache = BuiltInDatabaseDialectDefinitions.load();
    return this.cache;
  }
}
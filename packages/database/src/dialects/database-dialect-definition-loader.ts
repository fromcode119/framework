import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import { BuiltInDatabaseDialectDefinitions } from '@database/dialects/built-in-database-dialect-definitions';

export class DatabaseDialectDefinitionLoader {
  private static cache: IDatabaseDialectDefinition[] | null = null;

  static load(): IDatabaseDialectDefinition[] {
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
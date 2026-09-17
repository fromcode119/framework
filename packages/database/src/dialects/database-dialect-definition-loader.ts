import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import { BuiltInDatabaseDialectDefinitions } from '@database/dialects/built-in-database-dialect-definitions';

/**
 * The dialect definitions this build ships, loaded once.
 *
 * There used to be a `typeof window !== 'undefined'` branch here that cached an EMPTY list. It was
 * dead — nothing on a client surface reaches this, its only two callers are the factory and the
 * registry, and both are server-only — and it was the more dangerous of the two copies, because
 * caching `[]` is permanent: a single browser-shaped moment would have left the process believing
 * this build supports no database at all, for its whole life.
 */
export class DatabaseDialectDefinitionLoader {
  private static cache: IDatabaseDialectDefinition[] | null = null;

  static load(): IDatabaseDialectDefinition[] {
    if (this.cache) {
      return this.cache;
    }

    this.cache = BuiltInDatabaseDialectDefinitions.load();
    return this.cache;
  }
}
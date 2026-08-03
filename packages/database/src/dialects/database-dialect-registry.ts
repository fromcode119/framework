import type { IDatabaseBackupHandler } from '@database/dialects/interfaces/database-backup-handler.interface';
import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';
import { DatabaseDialectDefinitionLoader } from '@database/dialects/database-dialect-definition-loader';

export class DatabaseDialectRegistry {
  private static readonly fallbackDialect = 'postgres';

  private static readonly definitions = new Map<string, IDatabaseDialectDefinition>();

  private static readonly resolvers = new Map<string, IDatabaseDialectResolver>();

  private static isInitialized = false;

  static registerDefinition(definition: IDatabaseDialectDefinition): void {
    const normalizedDialect = String(definition?.dialect || '').trim().toLowerCase();
    if (!normalizedDialect) {
      throw new Error('Database dialect definition requires a dialect name.');
    }

    this.definitions.set(normalizedDialect, definition);
    this.resolvers.set(normalizedDialect, definition.createResolver());
  }

  static registerResolver(resolver: IDatabaseDialectResolver): void {
    const normalizedDialect = String(resolver?.dialect || '').trim().toLowerCase();
    if (!normalizedDialect) {
      throw new Error('Database dialect resolver requires a dialect name.');
    }

    this.resolvers.set(normalizedDialect, resolver);
  }

  static resolve(connection: string): string {
    this.ensureBuiltInsRegistered();

    const normalizedConnection = String(connection || '').trim();
    if (!normalizedConnection) {
      return this.fallbackDialect;
    }

    const resolver = Array.from(this.resolvers.values()).find((entry) => entry.matches(normalizedConnection));
    return resolver?.dialect || this.fallbackDialect;
  }

  static resolveDefinition(dialect: string): IDatabaseDialectDefinition | null {
    this.ensureBuiltInsRegistered();

    const normalizedDialect = String(dialect || '').trim().toLowerCase();
    return this.definitions.get(normalizedDialect) || null;
  }

  static resolveBackupHandler(connection: string): IDatabaseBackupHandler | null {
    const definition = this.resolveDefinition(this.resolve(connection));
    return definition?.createBackupHandler() || null;
  }

  private static ensureBuiltInsRegistered(): void {
    if (this.isInitialized) {
      return;
    }

    for (const definition of DatabaseDialectDefinitionLoader.load()) {
      const normalizedDialect = String(definition.dialect || '').trim().toLowerCase();
      if (normalizedDialect && !this.definitions.has(normalizedDialect)) {
        this.registerDefinition(definition);
      }
    }

    this.isInitialized = true;
  }
}
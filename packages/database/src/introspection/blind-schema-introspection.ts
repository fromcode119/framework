import type { IForeignKeyReference } from '@database/interfaces/foreign-key-reference.interface';
import type { ISchemaIntrospection } from '@database/interfaces/schema-introspection.interface';

/**
 * The answer from a driver that cannot be asked about its own schema: nothing.
 *
 * EMPTY RATHER THAN THROWN, unlike `RefusingTenantIsolation` next door, and the difference is what
 * each is protecting. Isolation must refuse: a driver that silently does not isolate is a driver
 * that silently leaks, so it has to be impossible to use by accident. Introspection is the opposite
 * — it feeds an export, and "this driver reports no tables" is a truthful, visible, harmless answer
 * that keeps the caller's code identical on every dialect.
 */
export class BlindSchemaIntrospection implements ISchemaIntrospection {
  async tablesWithColumn(_column: string): Promise<string[]> {
    return [];
  }

  async columnTypes(_tables: string[]): Promise<Map<string, Record<string, string>>> {
    return new Map();
  }

  async requiredColumns(_tables: string[], _excluding: string[]): Promise<Map<string, Set<string>>> {
    return new Map();
  }

  async serialSequences(_tables: string[]): Promise<Map<string, string>> {
    return new Map();
  }

  async foreignKeys(_tables: string[]): Promise<IForeignKeyReference[]> {
    return [];
  }
}

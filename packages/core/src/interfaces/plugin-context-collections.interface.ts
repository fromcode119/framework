import { ICollection } from '@core/interfaces/collection.interface';
import type { ICollectionInput } from '@core/interfaces/collection-input.interface';

/**
 * The `context.collections` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextCollections {
  register(collection: ICollectionInput): void;
  extend(targetPlugin: string, targetCollection: string, extensions: Partial<ICollection>): void;
  /**
   * Update one record of THIS plugin's own collection through the SAME path an admin save takes —
   * access policy, validation and collection lifecycle hooks included. This is the canonical write
   * for anything that must have side effects (licence minting, ledger writes, search indexing) — `context.db.update` is a
   * raw write that fires none of them. `options.user` is the acting user (e.g. the MCP caller).
   */
  update(collectionSlug: string, id: number | string, data: Record<string, unknown>, options?: { user?: unknown }): Promise<unknown>;
}

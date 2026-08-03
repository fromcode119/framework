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
}

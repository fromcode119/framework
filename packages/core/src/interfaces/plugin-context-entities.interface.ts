import { ICollection } from '@core/interfaces/collection.interface';
import type { IEntityParseOptions } from '@core/interfaces/entity-parse-options.interface';
import type { IEntityParseResult } from '@core/interfaces/entity-parse-result.interface';

/**
 * The `context.entities` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextEntities {
  parse(collection: ICollection, input: Record<string, unknown>, options?: IEntityParseOptions): IEntityParseResult;
  clean(collection: ICollection, input: Record<string, unknown>, options?: IEntityParseOptions): Record<string, unknown>;
}

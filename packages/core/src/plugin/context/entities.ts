import { CoreServices } from '@core/services/core-services';
import type { ICollection } from '@core/interfaces/collection.interface';
import type { IEntityParseOptions } from '@core/interfaces/entity-parse-options.interface';
import type { IEntityParseResult } from '@core/interfaces/entity-parse-result.interface';

export class EntitiesContextProxy {
  static createEntitiesProxy(): {
    parse(collection: ICollection, input: Record<string, unknown>, options?: IEntityParseOptions): IEntityParseResult;
    clean(collection: ICollection, input: Record<string, unknown>, options?: IEntityParseOptions): Record<string, unknown>;
  } {
    return {
      parse: (collection, input, options) => CoreServices.getInstance().entityValueParser.parseCollectionInput(collection, input, options),
      clean: (collection, input, options) => CoreServices.getInstance().entityValueParser.cleanCollectionInput(collection, input, options),
    };
  }
}

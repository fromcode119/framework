import { CoreServices } from '../../services/core-services';
import type { Collection, EntityParseOptions, EntityParseResult } from '../../types';

export class EntitiesContextProxy {
  static createEntitiesProxy(): {
    parse(collection: Collection, input: Record<string, unknown>, options?: EntityParseOptions): EntityParseResult;
    clean(collection: Collection, input: Record<string, unknown>, options?: EntityParseOptions): Record<string, unknown>;
  } {
    return {
      parse: (collection, input, options) => CoreServices.getInstance().entityValueParser.parseCollectionInput(collection, input, options),
      clean: (collection, input, options) => CoreServices.getInstance().entityValueParser.cleanCollectionInput(collection, input, options),
    };
  }
}

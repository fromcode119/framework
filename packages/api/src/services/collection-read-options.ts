import type { ICollectionReadOptions } from '@api/services/interfaces/collection-read-options.interface';

/** The request key a framework caller passes ICollectionReadOptions under. A Symbol, so no request can set it. */
export class CollectionReadOptions {
  static readonly KEY = Symbol('collection-read:options');

  static of(req: any): ICollectionReadOptions {
    return (req?.[CollectionReadOptions.KEY] as ICollectionReadOptions | undefined) ?? {};
  }
}

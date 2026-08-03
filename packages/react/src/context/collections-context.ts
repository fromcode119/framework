import { Context as ReactorContext } from '@fromcode119/reactor';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';

export class CollectionsContext {
  static readonly Context = new ReactorContext<ICollectionMetadata[]>([]).raw;
}

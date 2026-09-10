import { Context as ReactorContext } from '@fromcode119/react-class-components';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';

export class CollectionsContext {
  static readonly Context = new ReactorContext<ICollectionMetadata[]>([]).raw;
}

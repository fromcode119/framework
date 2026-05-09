import React from 'react';
import type { CollectionMetadata } from '../context.interfaces';

export class CollectionsContext {
  static readonly Context = React.createContext<CollectionMetadata[]>([]);
}

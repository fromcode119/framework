import type { CollectionQueryPrimitive } from './collection-utils.types';

export interface CollectionListPathOptions {
  limit?: number;
  search?: string;
  filters?: Record<string, CollectionQueryPrimitive>;
}

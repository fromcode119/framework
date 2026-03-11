import type { CollectionQueryPrimitive } from './collections.types';

export interface CollectionListPathOptions {
  limit?: number;
  search?: string;
  filters?: Record<string, CollectionQueryPrimitive>;
}

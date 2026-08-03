import type { ICollectionQueryBuilder } from '@plugins/interfaces/collection-query-builder.interface';

export interface IPluginProxy {
  slug: string;
  collection(name: string): ICollectionQueryBuilder;
  [key: string]: any; 
}

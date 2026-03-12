import { CollectionListPathOptions, CollectionUtils } from '@fromcode119/sdk';
import type { CollectionApiClient } from './collection-queries.interfaces';


export class CollectionQueryUtils {
  static async queryCollectionDocs(
    api: CollectionApiClient,
    collectionSlug: string,
    options: CollectionListPathOptions = {},
  ): Promise<any[]> {
    const response = await api.get(CollectionUtils.listPath(collectionSlug, options));
    return CollectionUtils.extractDocs(response);
  }

  static async queryCollectionDocById(
    api: CollectionApiClient,
    collectionSlug: string,
    recordId: string | number,
  ): Promise<any> {
    return api.get(CollectionUtils.docPath(collectionSlug, recordId));
  }

  static async queryCollectionDocByField(
    api: CollectionApiClient,
    collectionSlug: string,
    field: string,
    value: string | number,
    limit = 1,
  ): Promise<any | null> {
    const docs = await CollectionQueryUtils.queryCollectionDocs(api, collectionSlug, {
      limit,
      filters: { [field]: value },
    });
    return docs[0] || null;
  }
}

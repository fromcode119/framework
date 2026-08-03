import { ICollectionListPathOptions, CollectionUtils } from '@fromcode119/core/client';
import type { ICollectionApiClient } from '@react/interfaces/collection-api-client.interface';

export class CollectionQueryUtils {
  static async queryCollectionDocs(
    api: ICollectionApiClient,
    collectionSlug: string,
    options: ICollectionListPathOptions = {},
  ): Promise<any[]> {
    const response = await api.get(CollectionUtils.listPath(collectionSlug, options));
    return CollectionUtils.extractDocs(response);
  }

  static async queryCollectionDocById(
    api: ICollectionApiClient,
    collectionSlug: string,
    recordId: string | number,
  ): Promise<any> {
    return api.get(CollectionUtils.docPath(collectionSlug, recordId));
  }

  static async queryCollectionDocByField(
    api: ICollectionApiClient,
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

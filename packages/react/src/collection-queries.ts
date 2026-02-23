import {
  buildCollectionDocPath,
  buildCollectionListPath,
  CollectionListPathOptions,
  extractCollectionDocs
} from '@fromcode119/sdk';

export interface CollectionApiClient {
  get: (path: string, options?: any) => Promise<any>;
}

export async function queryCollectionDocs(
  api: CollectionApiClient,
  collectionSlug: string,
  options: CollectionListPathOptions = {}
): Promise<any[]> {
  const response = await api.get(buildCollectionListPath(collectionSlug, options));
  return extractCollectionDocs(response);
}

export async function queryCollectionDocById(
  api: CollectionApiClient,
  collectionSlug: string,
  recordId: string | number
): Promise<any> {
  return api.get(buildCollectionDocPath(collectionSlug, recordId));
}

export async function queryCollectionDocByField(
  api: CollectionApiClient,
  collectionSlug: string,
  field: string,
  value: string | number,
  limit = 1
): Promise<any | null> {
  const docs = await queryCollectionDocs(api, collectionSlug, {
    limit,
    filters: {
      [field]: value
    }
  });
  return docs[0] || null;
}


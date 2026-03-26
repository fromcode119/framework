import { CollectionUtils } from '../collection-utils';

export class CollectionScopeClient {
  constructor(
    private readonly requester: {
      get: (path: string, options?: any) => Promise<any>;
      post: (path: string, body?: any, options?: any) => Promise<any>;
      put: (path: string, body?: any, options?: any) => Promise<any>;
      patch: (path: string, body?: any, options?: any) => Promise<any>;
      delete: (path: string, options?: any) => Promise<any>;
    },
    private readonly collectionSlug: string,
  ) {}

  list(options?: any): Promise<any> {
    return this.requester.get(CollectionUtils.listPath(this.collectionSlug, options));
  }

  get(recordId: string | number, options?: any): Promise<any> {
    return this.requester.get(CollectionUtils.docPath(this.collectionSlug, recordId), options);
  }

  create(body?: any, options?: any): Promise<any> {
    return this.requester.post(CollectionUtils.listPath(this.collectionSlug), body, options);
  }

  update(recordId: string | number, body?: any, options?: any): Promise<any> {
    return this.requester.put(CollectionUtils.docPath(this.collectionSlug, recordId), body, options);
  }

  patch(recordId: string | number, body?: any, options?: any): Promise<any> {
    return this.requester.patch(CollectionUtils.docPath(this.collectionSlug, recordId), body, options);
  }

  delete(recordId: string | number, options?: any): Promise<any> {
    return this.requester.delete(CollectionUtils.docPath(this.collectionSlug, recordId), options);
  }
}

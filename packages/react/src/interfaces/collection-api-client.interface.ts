/**
 * Minimal API client interface for collection queries.
 * Typically satisfied by ContextHooks.usePlugin().
 */
export interface ICollectionApiClient {
  get(path: string): Promise<any>;
}

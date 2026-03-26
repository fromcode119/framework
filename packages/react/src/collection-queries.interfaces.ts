/**
 * Minimal API client interface for collection queries.
 * Typically satisfied by ContextHooks.usePlugin().
 */
export interface CollectionApiClient {
  get(path: string): Promise<any>;
}

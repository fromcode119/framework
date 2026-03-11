/**
 * Minimal API client interface for collection queries.
 * Typically satisfied by ContextHooks.usePluginAPI() return value.
 */
export interface CollectionApiClient {
  get(path: string): Promise<any>;
}

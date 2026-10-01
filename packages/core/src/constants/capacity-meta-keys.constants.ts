/**
 * How much the api holds and keeps (Settings → Infrastructure). Part of `SystemConstants.META_KEY` —
 * spread into `SystemMetaKeys.ALL` — and split out only for size.
 */
export class CapacityMetaKeys {
  static readonly ALL = {
    /** Longest a kept answer to an anonymous plugin GET is served, in seconds (ApiResponseCache); 0 = off. */
    API_RESPONSE_CACHE_SECONDS: 'api_response_cache_seconds',
    /** Most database connections the api's request pool holds at once (DatabasePoolRegistry). */
    DATABASE_POOL_MAX: 'database_pool_max',
  } as const;
}

/**
 * The Express request surface the rate-limit buckets read.
 *
 * Declared structurally rather than as `express.Request` so the bucket rules can be exercised with a
 * plain object — `express-rate-limit` hands the real request in, and a test hands in the four fields
 * that decide a bucket.
 */
export interface IRateLimitRequest {
  /** Express `req.ip` — the client address resolved through the trusted proxy chain. */
  ip?: unknown;
  method?: unknown;
  headers?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  /** The TCP peer — the one hop no forwarded header can forge. */
  socket?: { remoteAddress?: unknown };
  originalUrl?: unknown;
  url?: unknown;
  path?: unknown;
  baseUrl?: unknown;
}

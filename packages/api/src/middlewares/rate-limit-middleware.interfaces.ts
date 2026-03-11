export interface RateLimitOptions {
  /**
   * Time window in milliseconds.
   * @default 900000 (15 minutes)
   */
  windowMs?: number;

  /**
   * Maximum number of requests per window.
   * @default 100 (production) or 10000 (development)
   */
  maxRequests?: number;

  /**
   * Error message when rate limit is exceeded.
   * @default 'Too many requests from this IP, please try again later'
   */
  message?: string;

  /**
   * Callback to determine if rate limiting should be skipped for this request.
   */
  skip?: (req: Request) => boolean;
}

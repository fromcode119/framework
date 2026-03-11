/**
 * Utilities for processing route segments and path matching.
 */
export class RouteSegmentUtils {
  static readonly RESERVED_ROOT_SEGMENTS = new Set(['api', '_next', 'plugins', 'themes', 'media', 'uploads']);
  static readonly STATIC_FILE_EXT_RE = /\.(?:map|js|mjs|cjs|css|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|json|txt|xml|webm|mp4|mov|pdf)$/i;

  /**
   * Check if a route should bypass dynamic content resolution.
   * Returns true for reserved segments (api, _next, etc.) or static file extensions.
   */
  static shouldBypassDynamicRouting(segments: string[]): boolean {
    if (!segments.length) return false;
    const first = String(segments[0] || '').trim().toLowerCase();
    if (RouteSegmentUtils.RESERVED_ROOT_SEGMENTS.has(first)) return true;
    const last = String(segments[segments.length - 1] || '').trim().toLowerCase();
    return RouteSegmentUtils.STATIC_FILE_EXT_RE.test(last);
  }

  /**
   * Normalize a path string into an array of non-empty segments.
   */
  static normalizePathSegments(path: unknown): string[] {
    return String(path || '')
      .trim()
      .split('/')
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  /**
   * Check if segments array starts with a specific prefix.
   */
  static startsWithSegments(segments: string[], prefix: string[]): boolean {
    if (!prefix.length || segments.length < prefix.length) return false;
    return prefix.every((part, index) => segments[index] === part);
  }
}


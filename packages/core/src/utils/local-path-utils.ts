/**
 * Where to send a person after an auth step: a path on THIS site, or nothing.
 *
 * Starting with one `/` is not enough. `//host` and `/\host` are protocol-relative addresses a browser
 * follows off-site, and a browser also strips tabs and line breaks from an address before it reads it, so
 * `/<tab>/host` turns into `//host` after it passed a prefix check. One rule, used by the server and the
 * browser alike, so the two never disagree about what is local.
 */
export class LocalPathUtils {
  static readonly MAX_LENGTH = 512;

  /** `value` when it is a plain same-site path, otherwise `''`. */
  static safe(value: unknown): string {
    const path = typeof value === 'string' ? value.trim() : '';
    if (!path || path.length > LocalPathUtils.MAX_LENGTH) return '';
    if (!path.startsWith('/') || path.startsWith('//')) return '';
    // Control characters, any whitespace and backslashes: each can turn into a host after browser cleanup.
    if (/[\u0000-\u001F\u007F\s\\]/.test(path)) return '';
    return path;
  }
}
